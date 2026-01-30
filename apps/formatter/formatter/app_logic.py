from __future__ import annotations

from formatter.pipeline import format_markdown
from formatter.preview import summarize_ast


def build_preview_payload(text: str) -> dict:
    result = format_markdown(text)
    summary = summarize_ast(result["ast"])
    return {"summary": summary, "refs": result["refs"], "ast": result["ast"]}
