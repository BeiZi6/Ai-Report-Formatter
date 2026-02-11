from __future__ import annotations

import io
import os
from importlib import import_module
from typing import Any, Callable

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .export_stats import get_export_stats, increment_export_count
from .schemas import GenerateRequest, PreviewRequest

_build_preview_payload: Callable[..., Any] | None = None
_build_docx: Callable[..., Any] | None = None
_build_format_config: Callable[..., Any] | None = None


def _ensure_formatter_loaded() -> None:
    global _build_preview_payload, _build_docx, _build_format_config

    if (
        _build_preview_payload is not None
        and _build_docx is not None
        and _build_format_config is not None
    ):
        return

    app_logic = import_module("formatter.app_logic")
    docx_builder = import_module("formatter.docx_builder")
    ui_config = import_module("formatter.ui_config")

    _build_preview_payload = getattr(app_logic, "build_preview_payload")
    _build_docx = getattr(docx_builder, "build_docx")
    _build_format_config = getattr(ui_config, "build_format_config")


def build_preview_payload(*args: Any, **kwargs: Any) -> Any:
    _ensure_formatter_loaded()
    if _build_preview_payload is None:
        raise RuntimeError("formatter.app_logic.build_preview_payload is unavailable")
    return _build_preview_payload(*args, **kwargs)


def build_docx(*args: Any, **kwargs: Any) -> Any:
    _ensure_formatter_loaded()
    if _build_docx is None:
        raise RuntimeError("formatter.docx_builder.build_docx is unavailable")
    return _build_docx(*args, **kwargs)


def build_format_config(*args: Any, **kwargs: Any) -> Any:
    _ensure_formatter_loaded()
    if _build_format_config is None:
        raise RuntimeError("formatter.ui_config.build_format_config is unavailable")
    return _build_format_config(*args, **kwargs)

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
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/preview")
async def preview(payload: PreviewRequest) -> dict[str, object]:
    return build_preview_payload(
        payload.markdown,
        bibliography_style=payload.bibliography.style,
        bibliography_sources=payload.bibliography.sources_text,
    )


@app.post("/api/generate")
async def generate(payload: GenerateRequest) -> Response:
    preview_payload = build_preview_payload(
        payload.markdown,
        bibliography_style=payload.bibliography.style,
        bibliography_sources=payload.bibliography.sources_text,
    )

    try:
        if isinstance(payload.config, dict):
            config_dict = dict(payload.config)
        else:
            config_dict = payload.config.model_dump()
        format_config = build_format_config(**config_dict)
    except Exception as exc:  # defensive: surface config issues as 422
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    output_buffer = io.BytesIO()
    build_docx(preview_payload["ast"], output_buffer, config=format_config)
    data = output_buffer.getvalue()

    increment_export_count()

    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=ai-report.docx"},
    )


@app.get("/api/exports/stats")
async def export_stats() -> dict[str, int]:
    return get_export_stats()
