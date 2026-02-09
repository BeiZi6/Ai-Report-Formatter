from __future__ import annotations

from formatter.markdown_parser import render_preview_html
from formatter.pipeline import format_markdown
from formatter.preview import summarize_ast


def build_preview_payload(text: str) -> dict:
    result = format_markdown(text)
    summary = summarize_ast(result["ast"])
    preview_html = render_preview_html(text)
    return {
        "summary": summary,
        "refs": result["refs"],
        "ast": result["ast"],
        "preview_html": preview_html,
    }
