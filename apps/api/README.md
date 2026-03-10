# API (FastAPI Legacy Compatibility)

> This module is retained for compatibility only. The primary backend is now `apps/rust-api`.

## Install

```bash
python3 -m pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

## Desktop backend entrypoint

Run the legacy desktop API entrypoint:

```bash
python3 desktop_backend.py
```

Build a legacy desktop backend executable:

```bash
python3 -m pip install -r requirements-desktop.txt
python3 scripts/build_desktop_backend.py
```

> 开发模式下，`requirements.txt` 已包含 `-e ../formatter`，确保本地 formatter 可作为可编辑包被 FastAPI 导入。

## Endpoints

- `GET /healthz`
- `POST /api/preview`
- `POST /api/generate`
- `GET /api/exports/stats`

## Notes

- Preview/export supports inline code and table cells are centered with leading spaces trimmed.
- Desktop mode CORS allows `null` origin for `file://` renderer requests.
