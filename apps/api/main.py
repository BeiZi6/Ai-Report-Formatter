from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

# Ensure formatter package is importable when running via apps/api
FORMATTER_PATH = Path(__file__).resolve().parents[1] / "formatter"
if str(FORMATTER_PATH) not in sys.path:
    sys.path.insert(0, str(FORMATTER_PATH))

formatter_module = sys.modules.get("formatter")
if formatter_module is not None and not hasattr(formatter_module, "__path__"):
    del sys.modules["formatter"]

from formatter.app_logic import build_preview_payload
from formatter.docx_builder import build_docx
from formatter.ui_config import build_format_config

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/preview")
async def preview(payload: dict) -> dict:
    markdown = payload.get("markdown", "")
    return build_preview_payload(markdown)


@app.post("/api/generate")
async def generate(payload: dict) -> Response:
    config = payload.get("config", {})
    markdown = payload.get("markdown", "")
    preview_payload = build_preview_payload(markdown)

    format_config = build_format_config(**config)
    with tempfile.NamedTemporaryFile(suffix=".docx") as tmp:
        build_docx(preview_payload["ast"], tmp.name, config=format_config)
        tmp.seek(0)
        data = tmp.read()

    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=ai-report.docx"},
    )
