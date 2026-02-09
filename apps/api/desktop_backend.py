from __future__ import annotations

import os
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import TypedDict

import uvicorn


class ServerConfig(TypedDict):
    host: str
    port: int
    log_level: str


def ensure_local_import_paths() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    formatter_path = repo_root / "apps" / "formatter"

    for candidate in (repo_root, formatter_path):
        value = str(candidate)
        if value not in sys.path:
            sys.path.insert(0, value)


def build_server_config(env: Mapping[str, str]) -> ServerConfig:
    return {
        "host": env.get("DESKTOP_API_HOST", "127.0.0.1"),
        "port": int(env.get("DESKTOP_API_PORT", "8000")),
        "log_level": env.get("DESKTOP_API_LOG_LEVEL", "warning"),
    }


def run() -> None:
    ensure_local_import_paths()
    from apps.api.main import app

    server_config = build_server_config(os.environ)
    uvicorn.run(
        app,
        host=server_config["host"],
        port=server_config["port"],
        log_level=server_config["log_level"],
    )


if __name__ == "__main__":
    run()
