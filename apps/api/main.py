from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure formatter package is importable when running via apps/api
FORMATTER_PATH = Path(__file__).resolve().parents[1] / "formatter"
if str(FORMATTER_PATH) not in sys.path:
    sys.path.append(str(FORMATTER_PATH))

from formatter.app_logic import build_preview_payload

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/preview")
async def preview(payload: dict) -> dict:
    markdown = payload.get("markdown", "")
    return build_preview_payload(markdown)
