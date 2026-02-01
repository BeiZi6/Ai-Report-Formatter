from fastapi.testclient import TestClient

from apps.api.main import app


def test_generate_endpoint_returns_docx():
    client = TestClient(app)
    response = client.post(
        "/api/generate",
        json={
            "markdown": "# Title\n\nHello.",
            "config": {
                "cn_font": "SimSun",
                "en_font": "Times New Roman",
                "heading_font": "SimHei",
                "heading_size_pt": 16,
                "body_size_pt": 12,
                "line_spacing": 1.5,
                "para_before_pt": 0,
                "para_after_pt": 0,
                "first_line_indent": True,
                "justify": True,
                "clear_background": True,
                "page_num_position": "center",
            },
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert len(response.content) > 0
