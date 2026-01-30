from __future__ import annotations

from markdown_it import MarkdownIt


def parse_markdown(text: str) -> list[dict]:
    md = MarkdownIt()
    tokens = md.parse(text)
    ast: list[dict] = []
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token.type == "heading_open":
            level = int(token.tag[1])
            text_token = tokens[i + 1]
            ast.append({"type": "heading", "level": level, "text": text_token.content})
            i += 3
            continue
        if token.type == "paragraph_open":
            text_token = tokens[i + 1]
            ast.append({"type": "paragraph", "text": text_token.content})
            i += 3
            continue
        i += 1
    return ast
