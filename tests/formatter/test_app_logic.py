from formatter.app_logic import build_preview_payload


def test_build_preview_payload_returns_summary_and_refs():
    payload = build_preview_payload("# Title\n\nHello [1].")
    assert payload["summary"]["headings"] == 1
    assert payload["refs"] == ["[1]"]
