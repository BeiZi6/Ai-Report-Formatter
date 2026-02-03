from docx import Document
from docx.enum.text import WD_COLOR_INDEX

from formatter.config import FormatConfig
from formatter.docx_builder import build_docx


def test_build_docx_creates_docx(tmp_path):
    ast = [
        {"type": "heading", "level": 1, "text": "Title"},
        {"type": "paragraph", "text": "Hello"},
    ]
    output = tmp_path / "out.docx"
    build_docx(ast, output, FormatConfig())
    assert output.exists()


def test_build_docx_renders_bold_runs(tmp_path):
    ast = [
        {
            "type": "paragraph",
            "text": "Hello Bold",
            "runs": [
                {"text": "Hello ", "bold": False},
                {"text": "Bold", "bold": True},
            ],
        }
    ]
    output = tmp_path / "out.docx"
    build_docx(ast, output, FormatConfig())
    assert output.exists()

    doc = Document(output)
    runs = doc.paragraphs[0].runs
    assert runs[0].text == "Hello "
    assert runs[1].text == "Bold"
    assert runs[1].bold is True


def test_build_docx_renders_inline_styles(tmp_path):
    ast = [
        {
            "type": "paragraph",
            "runs": [
                {
                    "text": "It",
                    "bold": False,
                    "italic": True,
                    "strike": False,
                    "highlight": False,
                    "superscript": False,
                    "subscript": False,
                    "code": False,
                },
                {
                    "text": "S",
                    "bold": False,
                    "italic": False,
                    "strike": True,
                    "highlight": False,
                    "superscript": False,
                    "subscript": False,
                    "code": False,
                },
                {
                    "text": "H",
                    "bold": False,
                    "italic": False,
                    "strike": False,
                    "highlight": True,
                    "superscript": False,
                    "subscript": False,
                    "code": False,
                },
                {
                    "text": "2",
                    "bold": False,
                    "italic": False,
                    "strike": False,
                    "highlight": False,
                    "superscript": True,
                    "subscript": False,
                    "code": False,
                },
                {
                    "text": "2",
                    "bold": False,
                    "italic": False,
                    "strike": False,
                    "highlight": False,
                    "superscript": False,
                    "subscript": True,
                    "code": False,
                },
                {
                    "text": "code",
                    "bold": False,
                    "italic": False,
                    "strike": False,
                    "highlight": False,
                    "superscript": False,
                    "subscript": False,
                    "code": True,
                },
            ],
        }
    ]
    output = tmp_path / "out.docx"
    build_docx(ast, output, FormatConfig())

    doc = Document(output)
    runs = doc.paragraphs[0].runs
    assert runs[0].italic is True
    assert runs[1].font.strike is True
    assert runs[2].font.highlight_color == WD_COLOR_INDEX.YELLOW
    assert runs[3].font.superscript is True
    assert runs[4].font.subscript is True


def test_build_docx_renders_lists(tmp_path):
    ast = [
        {
            "type": "list",
            "ordered": False,
            "level": 1,
            "start": 1,
            "items": [
                [
                    {
                        "type": "paragraph",
                        "text": "第一项",
                        "runs": [
                            {
                                "text": "第一项",
                                "bold": False,
                                "italic": False,
                                "strike": False,
                                "highlight": False,
                                "superscript": False,
                                "subscript": False,
                                "code": False,
                            }
                        ],
                    }
                ],
                [
                    {
                        "type": "paragraph",
                        "text": "第二项",
                        "runs": [
                            {
                                "text": "第二项",
                                "bold": False,
                                "italic": False,
                                "strike": False,
                                "highlight": False,
                                "superscript": False,
                                "subscript": False,
                                "code": False,
                            }
                        ],
                    }
                ],
            ],
        }
    ]
    output = tmp_path / "out.docx"
    build_docx(ast, output, FormatConfig())
    doc = Document(output)
    assert doc.paragraphs[0].style.name.startswith("List Bullet")


def test_build_docx_renders_tables(tmp_path):
    ast = [
        {
            "type": "table",
            "align": ["left", "right"],
            "header": [
                {
                    "text": "列1",
                    "runs": [
                        {
                            "text": "列1",
                            "bold": False,
                            "italic": False,
                            "strike": False,
                            "highlight": False,
                            "superscript": False,
                            "subscript": False,
                            "code": False,
                        }
                    ],
                },
                {
                    "text": "列2",
                    "runs": [
                        {
                            "text": "列2",
                            "bold": False,
                            "italic": False,
                            "strike": False,
                            "highlight": False,
                            "superscript": False,
                            "subscript": False,
                            "code": False,
                        }
                    ],
                },
            ],
            "rows": [
                [
                    {
                        "text": "A",
                        "runs": [
                            {
                                "text": "A",
                                "bold": False,
                                "italic": False,
                                "strike": False,
                                "highlight": False,
                                "superscript": False,
                                "subscript": False,
                                "code": False,
                            }
                        ],
                    },
                    {
                        "text": "B",
                        "runs": [
                            {
                                "text": "B",
                                "bold": False,
                                "italic": False,
                                "strike": False,
                                "highlight": False,
                                "superscript": False,
                                "subscript": False,
                                "code": False,
                            }
                        ],
                    },
                ]
            ],
        }
    ]
    output = tmp_path / "out.docx"
    build_docx(ast, output, FormatConfig())
    doc = Document(output)
    assert len(doc.tables) == 1
    assert doc.tables[0].cell(0, 0).text == "列1"
    assert doc.tables[0].cell(1, 1).text == "B"


def test_build_docx_renders_math(tmp_path):
    ast = [
        {"type": "paragraph", "runs": [{"type": "math", "latex": "a^2 + b^2 = c^2"}]},
        {"type": "math_block", "latex": "x"},
    ]
    output = tmp_path / "out.docx"
    build_docx(ast, output, FormatConfig())
    doc = Document(output)
    xml = doc.part._element.xml
    assert "oMath" in xml


def test_math_block_adds_equation_number(tmp_path):
    ast = [{"type": "math_block", "latex": "x"}]
    output = tmp_path / "out.docx"
    build_docx(ast, output, FormatConfig())

    doc = Document(output)
    paragraph = doc.paragraphs[0]
    xml = paragraph._p.xml
    assert "SEQ Equation" in xml
