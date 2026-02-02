from fastapi.testclient import TestClient

from apps.api.main import app


def test_cors_allows_loopback_origin():
    client = TestClient(app)
    origin = "http://127.0.0.1:3000"
    response = client.options(
        "/api/preview",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin
