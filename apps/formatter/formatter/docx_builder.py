from __future__ import annotations

from docx import Document


def build_docx(ast: list[dict], output_path) -> None:
    doc = Document()
    for node in ast:
        if node.get("type") == "heading":
            doc.add_heading(node.get("text", ""), level=node.get("level", 1))
        elif node.get("type") == "paragraph":
            doc.add_paragraph(node.get("text", ""))
    doc.save(output_path)
