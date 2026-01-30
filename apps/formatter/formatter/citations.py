from __future__ import annotations

import re

_CITATION_RE = re.compile(r"\[(\d+)\]")


def normalize_citations(text: str) -> tuple[str, list[str]]:
    refs = [f"[{m.group(1)}]" for m in _CITATION_RE.finditer(text)]
    return text, refs
