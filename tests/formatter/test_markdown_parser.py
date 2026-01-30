from formatter.markdown_parser import parse_markdown


def test_parse_markdown_headings_and_paragraphs():
    ast = parse_markdown("# Title\n\nHello")
    assert ast == [
        {"type": "heading", "level": 1, "text": "Title"},
        {"type": "paragraph", "text": "Hello"},
    ]
