from formatter.preview import summarize_ast


def test_summarize_ast_counts_blocks():
    ast = [
        {"type": "heading", "level": 1, "text": "Title"},
        {"type": "paragraph", "text": "Hello"},
        {
            "type": "list",
            "ordered": False,
            "level": 1,
            "start": 1,
            "items": [
                [{"type": "paragraph", "text": "第一项"}],
                [{"type": "paragraph", "text": "第二项"}],
            ],
        },
        {
            "type": "table",
            "align": ["left"],
            "header": [{"text": "列1"}],
            "rows": [[{"text": "A"}]],
        },
        {"type": "math_block", "latex": "x"},
    ]
    summary = summarize_ast(ast)
    assert summary["headings"] == 1
    assert summary["paragraphs"] == 3
    assert summary["lists"] == 1
    assert summary["tables"] == 1
    assert summary["math_blocks"] == 1
