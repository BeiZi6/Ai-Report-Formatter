use std::io::Read;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use rust_api::{create_app, AppState};
use serde_json::Value;
use tempfile::TempDir;
use tower::util::ServiceExt;
use zip::ZipArchive;

fn test_state(temp_dir: &TempDir) -> AppState {
    AppState {
        export_db_path: PathBuf::from(temp_dir.path()).join("export_counts.db"),
    }
}

fn document_xml_from_docx(docx_bytes: &[u8]) -> String {
    let cursor = std::io::Cursor::new(docx_bytes);
    let mut archive = ZipArchive::new(cursor).expect("zip archive");
    let mut file = archive.by_name("word/document.xml").expect("document xml");
    let mut xml = String::new();
    file.read_to_string(&mut xml).expect("read xml");
    xml
}

fn write_one_pixel_png(path: &std::path::Path) {
    let bytes: &[u8] = &[
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 4,
        0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 252, 255, 31, 0, 3, 3,
        2, 0, 238, 169, 240, 191, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ];
    std::fs::write(path, bytes).expect("write png");
}

#[tokio::test]
async fn healthz_returns_ok() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));
    let request = Request::builder()
        .method(Method::GET)
        .uri("/healthz")
        .body(Body::empty())
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let value: Value = serde_json::from_slice(&bytes).expect("json");
    assert_eq!(value, serde_json::json!({ "status": "ok" }));
}

#[tokio::test]
async fn generate_succeeds_without_python_runtime() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "# Title",
        "config": {},
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/generate")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let content_type = response
        .headers()
        .get("content-type")
        .expect("content type")
        .to_str()
        .expect("to str");
    assert_eq!(
        content_type,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    assert!(bytes.starts_with(b"PK"));
}

#[tokio::test]
async fn preview_returns_expected_shape() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "# Title\n\nParagraph [1]",
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/preview")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let value: Value = serde_json::from_slice(&bytes).expect("json");

    assert_eq!(value["summary"]["headings"], 1);
    assert!(value["summary"]["paragraphs"].as_u64().unwrap_or_default() >= 1);
    assert_eq!(value["refs"].as_array().map_or(0, |items| items.len()), 1);
    assert!(value["preview_html"]
        .as_str()
        .unwrap_or_default()
        .contains("<h1>"));
}

#[tokio::test]
async fn preview_maps_bibliography_keys_to_numeric_refs() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "# Title\n\nSee [@smith2024].",
        "bibliography": {
            "style": "ieee",
            "sources_text": "@article{smith2024, author={Smith, John}, title={A Practical Study}, journal={Journal of Testing}, year={2024}}"
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/preview")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let value: Value = serde_json::from_slice(&bytes).expect("json");

    assert_eq!(value["refs"], serde_json::json!(["[1]"]));
    assert_eq!(value["lint_warnings"], serde_json::json!([]));
}

#[tokio::test]
async fn preview_includes_heading_level_jump_warning() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "# 一级\n\n#### 四级"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/preview")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let value: Value = serde_json::from_slice(&bytes).expect("json");

    let warnings = value["lint_warnings"].as_array().expect("array");
    let has_heading_jump = warnings
        .iter()
        .any(|item| item["code"] == serde_json::json!("heading_level_jump"));
    assert!(has_heading_jump);
}

#[tokio::test]
async fn generate_rejects_invalid_config_field_type() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "# Title\n\nHello.",
        "config": {
            "body_size_pt": "bad"
        },
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/generate")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn generate_rejects_invalid_bibliography_style() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "# Title\n\nHello.",
        "config": {},
        "bibliography": {
            "style": "invalid-style",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/generate")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn generate_returns_docx_and_updates_stats() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "# Title\n\nParagraph body.",
        "config": {},
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let generate_request = Request::builder()
        .method(Method::POST)
        .uri("/api/generate")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let generate_response = app
        .clone()
        .oneshot(generate_request)
        .await
        .expect("response");
    assert_eq!(generate_response.status(), StatusCode::OK);

    let content_type = generate_response
        .headers()
        .get("content-type")
        .expect("content type")
        .to_str()
        .expect("to str");
    assert_eq!(
        content_type,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    let content_disposition = generate_response
        .headers()
        .get("content-disposition")
        .expect("content disposition")
        .to_str()
        .expect("to str");
    assert!(content_disposition.contains("ai-report.docx"));

    let docx_bytes = axum::body::to_bytes(generate_response.into_body(), usize::MAX)
        .await
        .expect("body");
    assert!(docx_bytes.starts_with(b"PK"));

    let stats_request = Request::builder()
        .method(Method::GET)
        .uri("/api/exports/stats")
        .body(Body::empty())
        .expect("request");
    let stats_response = app.oneshot(stats_request).await.expect("response");
    assert_eq!(stats_response.status(), StatusCode::OK);

    let stats_bytes = axum::body::to_bytes(stats_response.into_body(), usize::MAX)
        .await
        .expect("body");
    let stats_value: Value = serde_json::from_slice(&stats_bytes).expect("json");

    assert!(stats_value["today"].as_u64().unwrap_or_default() >= 1);
    assert!(stats_value["total"].as_u64().unwrap_or_default() >= 1);
}

#[tokio::test]
async fn generate_math_block_contains_numbered_equation_markers() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "$$ x $$",
        "config": {},
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/generate")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let docx_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let document_xml = document_xml_from_docx(&docx_bytes);

    assert!(document_xml.contains("SEQ Equation"));
    assert!(document_xml.contains("<m:oMath"));
    assert!(document_xml.contains("<m:box>"));
}

#[tokio::test]
async fn generate_multiple_math_blocks_keep_sequence_fields() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "$$ x $$\n\n$$ y $$",
        "config": {},
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/generate")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let docx_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let document_xml = document_xml_from_docx(&docx_bytes);

    assert_eq!(document_xml.matches("SEQ Equation").count(), 2);
}

#[tokio::test]
async fn generate_math_block_contains_center_right_tabs() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "$$ x $$",
        "config": {},
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/generate")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let docx_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let document_xml = document_xml_from_docx(&docx_bytes);

    assert!(document_xml.contains("w:tab w:val=\"center\""));
    assert!(document_xml.contains("w:tab w:val=\"right\""));
    let first_tab = document_xml
        .find("<w:tab/>")
        .or_else(|| document_xml.find("<w:tab />"))
        .expect("tab run");
    let first_math = document_xml.find("<m:oMath").expect("math run");
    assert!(first_tab < first_math);
}

#[tokio::test]
async fn generate_list_math_block_keeps_equation_field_markers() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "- $$ a $$",
        "config": {},
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/generate")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let docx_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let document_xml = document_xml_from_docx(&docx_bytes);

    assert!(document_xml.contains("SEQ Equation"));
    assert!(document_xml.contains("<m:oMath"));
    assert!(document_xml.contains("w:fldCharType=\"begin\""));
    assert!(document_xml.contains("w:fldCharType=\"separate\""));
    assert!(document_xml.contains("w:fldCharType=\"end\""));
    assert!(document_xml.contains("w:pStyle w:val=\"ListBullet\""));
    assert!(document_xml.contains("w:jc w:val=\"left\""));
    assert!(document_xml.contains("w:left=\"360\""));
    assert!(document_xml.contains("w:hanging=\"180\""));
}

#[tokio::test]
async fn generate_ordered_list_math_block_uses_list_number_style() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let payload = serde_json::json!({
        "markdown": "1. $$ a $$",
        "config": {},
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/generate")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let docx_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let document_xml = document_xml_from_docx(&docx_bytes);

    assert!(document_xml.contains("w:pStyle w:val=\"ListNumber\""));
    assert!(document_xml.contains("w:jc w:val=\"left\""));
    assert!(document_xml.contains("SEQ Equation"));
    assert!(document_xml.contains("<m:oMath"));
}

#[tokio::test]
async fn preview_rich_markdown_includes_core_feature_nodes() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let markdown = "# 标题\n\n- [x] 完成项\n- 普通项\n\n> 引用段落\n\n| 列1 | 列2 |\n| --- | --- |\n| A | B |\n\n![图](demo.png)\n\n$$ x + y $$\n";
    let payload = serde_json::json!({
        "markdown": markdown,
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/preview")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let value: Value = serde_json::from_slice(&bytes).expect("json");

    assert!(value["summary"]["lists"].as_u64().unwrap_or_default() >= 1);
    assert!(value["summary"]["tables"].as_u64().unwrap_or_default() >= 1);
    assert!(value["summary"]["figures"].as_u64().unwrap_or_default() >= 1);
    assert!(value["summary"]["math_blocks"].as_u64().unwrap_or_default() >= 1);

    let ast = value["ast"].as_array().expect("ast array");
    let ast_json = serde_json::to_string(ast).expect("ast json");
    assert!(ast_json.contains("\"type\":\"list\""));
    assert!(ast_json.contains("\"type\":\"blockquote\""));
    assert!(ast_json.contains("\"type\":\"table\""));
    assert!(ast_json.contains("\"type\":\"figure\""));
    assert!(ast_json.contains("\"type\":\"math_block\""));
}

#[tokio::test]
async fn generate_renders_table_figure_and_math_markers_together() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let app = create_app(test_state(&temp_dir));

    let image_path = temp_dir.path().join("figure.png");
    write_one_pixel_png(&image_path);

    let markdown = format!(
        "| A | B |\n| --- | --- |\n| 1 | 2 |\n\n![图]({})\n\n$$ x $$\n",
        image_path.to_string_lossy()
    );

    let payload = serde_json::json!({
        "markdown": markdown,
        "config": {},
        "bibliography": {
            "style": "ieee",
            "sources_text": ""
        }
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/generate")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let docx_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let document_xml = document_xml_from_docx(&docx_bytes);

    assert!(document_xml.contains("w:tblBorders"));
    assert!(document_xml.contains("graphicData"));
    assert!(document_xml.contains("SEQ Equation"));
    assert!(document_xml.contains("<m:oMath"));
}
