# API (FastAPI)

## Install

```bash
python3 -m pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

## Desktop backend entrypoint

Run the desktop API entrypoint (used by Electron dev mode):

```bash
python3 desktop_backend.py
```

Build a bundled desktop backend executable (used by Electron packaging):

```bash
python3 -m pip install -r requirements-desktop.txt
python3 scripts/build_desktop_backend.py
```

> 开发模式下，`requirements.txt` 已包含 `-e ../formatter`，确保本地 formatter 可作为可编辑包被 FastAPI 导入。

## Endpoints

- `POST /api/preview`
- `POST /api/generate`

## Notes

- Preview/export supports inline code and table cells are centered with leading spaces trimmed.
- Desktop mode CORS allows `null` origin for `file://` renderer requests.
