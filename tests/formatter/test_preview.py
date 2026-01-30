from formatter.preview import summarize_ast


def test_summarize_ast_counts_blocks():
    ast = [
        {"type": "heading", "level": 1, "text": "Title"},
        {"type": "paragraph", "text": "Hello"},
    ]
    summary = summarize_ast(ast)
    assert summary["headings"] == 1
    assert summary["paragraphs"] == 1
