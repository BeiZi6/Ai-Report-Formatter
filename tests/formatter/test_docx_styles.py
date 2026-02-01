from docx import Document
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.shared import Cm, Pt

from formatter.config import FormatConfig
from formatter.docx_builder import build_docx


def test_docx_styles_and_margins_applied(tmp_path):
    config = FormatConfig()
    output = tmp_path / "out.docx"
    ast = [
        {"type": "heading", "level": 1, "text": "Title"},
        {"type": "paragraph", "text": "Hello"},
    ]
    build_docx(ast, output, config)

    doc = Document(output)
    section = doc.sections[0]
    assert round(section.top_margin.cm, 2) == 2.54
    assert round(section.left_margin.cm, 2) == 3.18

    normal = doc.styles["Normal"]
    assert normal.font.size == Pt(config.body_style.size_pt)

    h1 = doc.styles["Heading 1"]
    assert h1.font.size == Pt(config.heading_styles[1].size_pt)


def test_body_paragraph_indent_and_alignment(tmp_path):
    config = FormatConfig()
    output = tmp_path / "out.docx"
    build_docx([{"type": "paragraph", "text": "Hello"}], output, config)

    doc = Document(output)
    paragraph = doc.paragraphs[0]
    assert paragraph.alignment == WD_PARAGRAPH_ALIGNMENT.JUSTIFY
    assert paragraph.paragraph_format.first_line_indent == Pt(
        config.body_style.size_pt * 2
    )


def test_build_docx_falls_back_on_style_failure(tmp_path, monkeypatch):
    def _boom(*args, **kwargs):
        raise RuntimeError("style write failed")

    monkeypatch.setattr("formatter.docx_builder._apply_style_paragraph", _boom)

    output = tmp_path / "out.docx"
    config = FormatConfig()
    build_docx([{"type": "paragraph", "text": "Hello"}], output, config)

    doc = Document(output)
    paragraph = doc.paragraphs[0]
    assert paragraph.alignment == WD_PARAGRAPH_ALIGNMENT.JUSTIFY
    assert paragraph.paragraph_format.first_line_indent == Pt(
        config.body_style.size_pt * 2
    )
