from formatter.docx_builder import build_docx


def test_build_docx_creates_docx(tmp_path):
    ast = [
        {"type": "heading", "level": 1, "text": "Title"},
        {"type": "paragraph", "text": "Hello"},
    ]
    output = tmp_path / "out.docx"
    build_docx(ast, output)
    assert output.exists()
