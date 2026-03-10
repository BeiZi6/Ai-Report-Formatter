use std::net::SocketAddr;
use std::path::PathBuf;

use rust_api::{create_app, AppState};

#[tokio::main]
async fn main() {
    let default_db_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("data")
        .join("export_counts.db");
    let db_path = std::env::var("EXPORT_DB_PATH")
        .map(PathBuf::from)
        .unwrap_or(default_db_path);

    let state = AppState {
        export_db_path: db_path,
    };

    let app = create_app(state);
    let host = std::env::var("API_HOST").unwrap_or_else(|_| String::from("127.0.0.1"));
    let port = std::env::var("API_PORT").unwrap_or_else(|_| String::from("8000"));
    let addr: SocketAddr = format!("{}:{}", host, port)
        .parse()
        .expect("invalid API_HOST/API_PORT");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind listener");
    axum::serve(listener, app).await.expect("server failed");
}
