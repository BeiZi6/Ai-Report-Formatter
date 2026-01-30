from __future__ import annotations

from formatter.citations import normalize_citations
from formatter.markdown_parser import parse_markdown


def format_markdown(text: str) -> dict:
    normalized, refs = normalize_citations(text)
    ast = parse_markdown(normalized)
    return {"ast": ast, "refs": refs}
