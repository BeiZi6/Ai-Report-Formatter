from __future__ import annotations


def summarize_ast(ast: list[dict]) -> dict[str, int]:
    counts = {"headings": 0, "paragraphs": 0}
    for node in ast:
        if node.get("type") == "heading":
            counts["headings"] += 1
        if node.get("type") == "paragraph":
            counts["paragraphs"] += 1
    return counts
