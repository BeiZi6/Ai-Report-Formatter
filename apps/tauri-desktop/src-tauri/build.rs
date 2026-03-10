use std::{env, fs, path::PathBuf, process::Command};

fn main() {
    tauri_build::build();

    let profile = env::var("PROFILE").unwrap_or_else(|_| String::from("debug"));
    if profile != "release" {
        return;
    }

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let workspace_root = manifest_dir
        .parent()
        .and_then(|path| path.parent())
        .and_then(|path| path.parent())
        .expect("resolve workspace root")
        .to_path_buf();

    let target = env::var("TARGET").expect("TARGET");
    let is_windows = target.contains("windows");
    let binary_name = if is_windows {
        "rust-api.exe"
    } else {
        "rust-api"
    };

    let rust_api_manifest = workspace_root.join("apps/rust-api/Cargo.toml");
    let target_dir = workspace_root.join("target");

    let status = Command::new("cargo")
        .arg("build")
        .arg("--manifest-path")
        .arg(&rust_api_manifest)
        .arg("--bin")
        .arg("rust-api")
        .arg("--release")
        .arg("--target")
        .arg(&target)
        .env("CARGO_TARGET_DIR", &target_dir)
        .status()
        .expect("spawn cargo build rust-api");

    if !status.success() {
        panic!("building rust-api failed: {status}");
    }

    let source_bin = target_dir.join(&target).join("release").join(binary_name);
    let binaries_dir = manifest_dir.join("binaries");
    fs::create_dir_all(&binaries_dir).expect("create binaries dir");
    let destination_bin = binaries_dir.join(binary_name);
    fs::copy(&source_bin, &destination_bin).unwrap_or_else(|err| {
        panic!(
            "copy rust-api binary failed ({} -> {}): {err}",
            source_bin.display(),
            destination_bin.display()
        )
    });

    println!(
        "cargo:rerun-if-changed={}",
        workspace_root.join("apps/rust-api/src").display()
    );
    println!("cargo:rerun-if-changed={}", rust_api_manifest.display());
}
