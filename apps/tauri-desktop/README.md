# Tauri Desktop Frontend

Tauri v2 desktop shell that reuses the existing `apps/web` UI and launches local Rust backend (`apps/rust-api`).

## Prerequisites

- Rust toolchain
- Tauri CLI (`cargo install tauri-cli --version '^2.0.0'`)
- Node dependencies installed for `apps/web`

## Run (development)

```bash
cargo tauri dev --manifest-path apps/tauri-desktop/src-tauri/Cargo.toml
```

## Build installers

```bash
cargo tauri build --manifest-path apps/tauri-desktop/src-tauri/Cargo.toml
```

## Notes

- Dev mode loads `http://localhost:3000`.
- Build mode loads static export from `apps/web/out`.
- `rust-api` is started by Tauri app lifecycle and stopped on exit.
