# Rust API

Rust implementation of the backend API contract used by the web/electron frontend.

## Run

```bash
cargo run --manifest-path apps/rust-api/Cargo.toml --bin rust-api
```

Default bind is `127.0.0.1:8000`.

Environment variables:

- `API_HOST` (default: `127.0.0.1`)
- `API_PORT` (default: `8000`)
- `EXPORT_DB_PATH` (default: `apps/rust-api/data/export_counts.db`)
- `API_CORS_EXTRA_ORIGINS` (comma-separated origins)

`/api/generate` is implemented natively in Rust and no longer depends on a Python runtime.

## Test

```bash
cargo test --manifest-path apps/rust-api/Cargo.toml
```

## Benchmark

Run staged `/api/generate` pipeline benchmark (parse/build/patch + total):

```bash
cargo run --manifest-path apps/rust-api/Cargo.toml --bin bench_generate -- --iterations 50
```

Optional input markdown file:

```bash
cargo run --manifest-path apps/rust-api/Cargo.toml --bin bench_generate -- --iterations 50 --input /path/to/sample.md
```
