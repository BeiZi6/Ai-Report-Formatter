#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::Manager;

const APP_DISPLAY_NAME: &str = "AI Report Formatter";
const BACKEND_HOST: &str = "127.0.0.1";
const BACKEND_PORT: u16 = 8000;
const BACKEND_WAIT_TIMEOUT: Duration = Duration::from_secs(45);
const BACKEND_POLL_INTERVAL: Duration = Duration::from_millis(250);
const TAURI_CORS_ORIGINS: &str = "tauri://localhost,http://tauri.localhost";

#[derive(Default)]
struct BackendState {
    child: Mutex<Option<Child>>,
}

fn is_backend_ready() -> bool {
    TcpStream::connect((BACKEND_HOST, BACKEND_PORT)).is_ok()
}

fn wait_backend_ready() -> Result<(), String> {
    let deadline = Instant::now() + BACKEND_WAIT_TIMEOUT;
    while Instant::now() < deadline {
        if is_backend_ready() {
            return Ok(());
        }
        thread::sleep(BACKEND_POLL_INTERVAL);
    }

    Err(format!(
        "backend readiness timeout on {}:{}",
        BACKEND_HOST, BACKEND_PORT
    ))
}

fn build_export_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("resolve app data dir failed: {err}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|err| format!("create app data dir failed: {err}"))?;

    let backend_dir = app_data_dir.join("backend");
    fs::create_dir_all(&backend_dir).map_err(|err| format!("create backend dir failed: {err}"))?;
    Ok(backend_dir.join("export_counts.db"))
}

fn spawn_backend_dev(app: &tauri::AppHandle) -> Result<Child, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let rust_api_manifest = manifest_dir.join("../../rust-api/Cargo.toml");
    let export_db_path = build_export_db_path(app)?;

    Command::new("cargo")
        .arg("run")
        .arg("--manifest-path")
        .arg(rust_api_manifest)
        .arg("--bin")
        .arg("rust-api")
        .env("API_HOST", BACKEND_HOST)
        .env("API_PORT", BACKEND_PORT.to_string())
        .env("API_CORS_EXTRA_ORIGINS", TAURI_CORS_ORIGINS)
        .env("EXPORT_DB_PATH", export_db_path)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|err| format!("spawn rust-api (dev) failed: {err}"))
}

fn spawn_backend_release(app: &tauri::AppHandle) -> Result<Child, String> {
    let binary_name = if cfg!(target_os = "windows") {
        "rust-api.exe"
    } else {
        "rust-api"
    };
    let binary_path = app
        .path()
        .resource_dir()
        .map_err(|err| format!("resolve resource dir failed: {err}"))?
        .join("binaries")
        .join(binary_name);
    let export_db_path = build_export_db_path(app)?;

    Command::new(binary_path)
        .env("API_HOST", BACKEND_HOST)
        .env("API_PORT", BACKEND_PORT.to_string())
        .env("API_CORS_EXTRA_ORIGINS", TAURI_CORS_ORIGINS)
        .env("EXPORT_DB_PATH", export_db_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|err| format!("spawn rust-api (release) failed: {err}"))
}

fn start_backend(app: &tauri::AppHandle) -> Result<Option<Child>, String> {
    if is_backend_ready() {
        return Ok(None);
    }

    let mut child = if cfg!(debug_assertions) {
        spawn_backend_dev(app)?
    } else {
        spawn_backend_release(app)?
    };

    if let Err(err) = wait_backend_ready() {
        let _ = child.kill();
        let _ = child.wait();
        return Err(err);
    }

    Ok(Some(child))
}

fn stop_backend(state: &BackendState) {
    if let Ok(mut guard) = state.child.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[cfg(target_os = "macos")]
fn install_macos_app_menu(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::menu::{
        AboutMetadata, Menu, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
    };

    let about_text = format!("About {APP_DISPLAY_NAME}");
    let hide_text = format!("Hide {APP_DISPLAY_NAME}");
    let quit_text = format!("Quit {APP_DISPLAY_NAME}");
    let about_metadata = AboutMetadata {
        name: Some(APP_DISPLAY_NAME.to_string()),
        version: Some(env!("CARGO_PKG_VERSION").to_string()),
        ..Default::default()
    };

    let window_menu = Submenu::with_id_and_items(
        app,
        WINDOW_SUBMENU_ID,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None).map_err(|err| err.to_string())?,
            &PredefinedMenuItem::maximize(app, None).map_err(|err| err.to_string())?,
            &PredefinedMenuItem::separator(app).map_err(|err| err.to_string())?,
            &PredefinedMenuItem::close_window(app, None).map_err(|err| err.to_string())?,
        ],
    )
    .map_err(|err| format!("build window submenu failed: {err}"))?;

    let help_menu = Submenu::with_id_and_items(app, HELP_SUBMENU_ID, "Help", true, &[])
        .map_err(|err| format!("build help submenu failed: {err}"))?;

    let menu = Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                APP_DISPLAY_NAME,
                true,
                &[
                    &PredefinedMenuItem::about(
                        app,
                        Some(about_text.as_str()),
                        Some(about_metadata),
                    )
                    .map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::separator(app).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::services(app, None).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::separator(app).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::hide(app, Some(hide_text.as_str()))
                        .map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::hide_others(app, None).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::separator(app).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::quit(app, Some(quit_text.as_str()))
                        .map_err(|err| err.to_string())?,
                ],
            )
            .map_err(|err| format!("build app submenu failed: {err}"))?,
            &Submenu::with_items(
                app,
                "File",
                true,
                &[&PredefinedMenuItem::close_window(app, None).map_err(|err| err.to_string())?],
            )
            .map_err(|err| format!("build file submenu failed: {err}"))?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::redo(app, None).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::separator(app).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::cut(app, None).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::copy(app, None).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::paste(app, None).map_err(|err| err.to_string())?,
                    &PredefinedMenuItem::select_all(app, None).map_err(|err| err.to_string())?,
                ],
            )
            .map_err(|err| format!("build edit submenu failed: {err}"))?,
            &Submenu::with_items(
                app,
                "View",
                true,
                &[&PredefinedMenuItem::fullscreen(app, None).map_err(|err| err.to_string())?],
            )
            .map_err(|err| format!("build view submenu failed: {err}"))?,
            &window_menu,
            &help_menu,
        ],
    )
    .map_err(|err| format!("build app menu failed: {err}"))?;

    app.set_menu(menu)
        .map(|_| ())
        .map_err(|err| format!("apply app menu failed: {err}"))
}

fn main() {
    tauri::Builder::default()
        .manage(BackendState::default())
        .setup(|app| {
            let backend_state = app.state::<BackendState>();
            let child = start_backend(app.handle())
                .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))?;

            if let Ok(mut guard) = backend_state.child.lock() {
                *guard = child;
            }

            #[cfg(target_os = "macos")]
            install_macos_app_menu(app.handle())
                .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("build tauri app failed")
        .run(|app, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                if let Some(state) = app.try_state::<BackendState>() {
                    stop_backend(&state);
                }
            }
        });
}
