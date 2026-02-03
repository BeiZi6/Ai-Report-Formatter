from __future__ import annotations


def summarize_ast(ast: list[dict]) -> dict[str, int]:
    counts = {"headings": 0, "paragraphs": 0, "lists": 0, "tables": 0, "math_blocks": 0}

    def walk(nodes: list[dict]) -> None:
        for node in nodes:
            ntype = node.get("type")
            if ntype == "heading":
                counts["headings"] += 1
            elif ntype == "paragraph":
                counts["paragraphs"] += 1
            elif ntype == "list":
                counts["lists"] += 1
                for item in node.get("items", []):
                    walk(item)
            elif ntype == "table":
                counts["tables"] += 1
            elif ntype == "math_block":
                counts["math_blocks"] += 1

    walk(ast)
    return counts
