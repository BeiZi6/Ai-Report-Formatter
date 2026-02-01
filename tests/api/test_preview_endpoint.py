from fastapi.testclient import TestClient

from apps.api.main import app


def test_preview_endpoint_returns_summary_and_refs():
    client = TestClient(app)
    response = client.post(
        "/api/preview",
        json={"markdown": "# Title\n\nHello [1]."},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["headings"] == 1
    assert payload["refs"] == ["[1]"]
