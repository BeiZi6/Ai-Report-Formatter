from __future__ import annotations

import os
import tempfile

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from formatter.app_logic import build_preview_payload
from formatter.docx_builder import build_docx
from formatter.ui_config import build_format_config

from .export_stats import get_export_stats, increment_export_count
from .schemas import GenerateRequest, PreviewRequest

app = FastAPI()

default_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "null",
]

extra_origins = [
    origin.strip()
    for origin in os.getenv("API_CORS_EXTRA_ORIGINS", "").split(",")
    if origin.strip()
]

allowed_origins = list(dict.fromkeys([*default_allowed_origins, *extra_origins]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@app.post("/api/preview")
async def preview(payload: PreviewRequest) -> dict:
    return build_preview_payload(payload.markdown)


@app.post("/api/generate")
async def generate(payload: GenerateRequest) -> Response:
    preview_payload = build_preview_payload(payload.markdown)

    try:
        config_dict = payload.config.model_dump() if hasattr(payload.config, "model_dump") else dict(payload.config)
        format_config = build_format_config(**config_dict)
    except Exception as exc:  # defensive: surface config issues as 422
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    with tempfile.NamedTemporaryFile(suffix=".docx") as tmp:
        build_docx(preview_payload["ast"], tmp.name, config=format_config)
        tmp.seek(0)
        data = tmp.read()

    increment_export_count()

    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=ai-report.docx"},
    )


@app.get("/api/exports/stats")
async def export_stats() -> dict:
    return get_export_stats()
