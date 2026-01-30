from formatter.pipeline import format_markdown


def test_pipeline_returns_ast_and_refs():
    result = format_markdown("# Title\n\nHello [1].")
    assert result["refs"] == ["[1]"]
    assert result["ast"][0]["type"] == "heading"
