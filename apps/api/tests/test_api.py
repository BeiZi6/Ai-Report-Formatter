from __future__ import annotations

from fastapi.testclient import TestClient
from docx import Document

from apps.api.main import app
from apps.api.export_stats import get_export_stats


client = TestClient(app)


def test_healthz_returns_ok():
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_preview_requires_schema():
    resp = client.post("/api/preview", json={})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ast"] == []
    assert body["refs"] == []
    assert isinstance(body.get("summary"), dict)


def test_generate_missing_markdown_is_422():
    resp = client.post("/api/generate", json={"config": {"body_size_pt": "bad"}})
    assert resp.status_code == 422


def test_generate_success_increments_counter(tmp_path):
    before = get_export_stats()["total"]

    payload = {
        "markdown": "# 标题\n\n正文",
        "config": {},
    }
    resp = client.post("/api/generate", json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    after = get_export_stats()["total"]
    assert after == before + 1


def test_generate_returns_numbered_math_block(tmp_path):
    payload = {"markdown": "$$ x $$", "config": {}}
    resp = client.post("/api/generate", json=payload)
    assert resp.status_code == 200, resp.text

    doc_path = tmp_path / "out.docx"
    doc_path.write_bytes(resp.content)

    doc = Document(doc_path)
    para = doc.paragraphs[0]
    assert "SEQ Equation" in para._p.xml
    assert "oMath" in para._p.xml
