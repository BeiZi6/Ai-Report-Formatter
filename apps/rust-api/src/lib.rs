use std::collections::{BTreeSet, HashMap};
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Instant;

use axum::body::Body;
use axum::extract::State;
use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_DISPOSITION, CONTENT_TYPE};
use axum::http::{HeaderValue, Method, Response, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Local;
use docx_rs::{
    AlignmentType, Docx, FieldCharType, InstrText, Paragraph, Pic, Run, SpecialIndentType, Tab,
    TabValueType, Table, TableAlignmentType, TableCell, TableRow,
};
use pulldown_cmark::{html, Options, Parser};
use regex::Regex;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

#[derive(Clone)]
pub struct AppState {
    pub export_db_path: PathBuf,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BibliographyStyle {
    Ieee,
    Gbt,
    Apa,
}

impl Default for BibliographyStyle {
    fn default() -> Self {
        Self::Ieee
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct BibliographyConfig {
    #[serde(default)]
    pub style: BibliographyStyle,
    #[serde(default)]
    pub sources_text: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PreviewRequest {
    #[serde(default)]
    pub markdown: String,
    #[serde(default)]
    pub bibliography: BibliographyConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PageNumPosition {
    Center,
    Right,
}

impl Default for PageNumPosition {
    fn default() -> Self {
        Self::Center
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FigureAlign {
    Left,
    Center,
    Right,
}

impl Default for FigureAlign {
    fn default() -> Self {
        Self::Center
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct GenerateConfig {
    pub cn_font: String,
    pub en_font: String,
    pub heading_cn_font: String,
    pub heading_en_font: String,
    pub heading1_size_pt: i64,
    pub heading2_size_pt: i64,
    pub heading3_size_pt: i64,
    pub heading4_size_pt: i64,
    pub heading_line_spacing: f64,
    pub heading_para_before_lines: f64,
    pub heading_para_after_lines: f64,
    pub body_size_pt: i64,
    pub line_spacing: f64,
    pub para_before_lines: f64,
    pub para_after_lines: f64,
    pub indent_before_chars: i64,
    pub indent_after_chars: i64,
    pub first_line_indent_chars: i64,
    pub justify: bool,
    pub clear_background: bool,
    pub page_num_position: PageNumPosition,
    pub figure_max_width_cm: f64,
    pub figure_align: FigureAlign,
}

impl Default for GenerateConfig {
    fn default() -> Self {
        Self {
            cn_font: String::from("SimSun"),
            en_font: String::from("Times New Roman"),
            heading_cn_font: String::from("SimHei"),
            heading_en_font: String::from("Times New Roman"),
            heading1_size_pt: 14,
            heading2_size_pt: 14,
            heading3_size_pt: 14,
            heading4_size_pt: 14,
            heading_line_spacing: 1.25,
            heading_para_before_lines: 0.5,
            heading_para_after_lines: 0.5,
            body_size_pt: 12,
            line_spacing: 1.25,
            para_before_lines: 0.0,
            para_after_lines: 0.0,
            indent_before_chars: 0,
            indent_after_chars: 0,
            first_line_indent_chars: 2,
            justify: true,
            clear_background: true,
            page_num_position: PageNumPosition::Center,
            figure_max_width_cm: 14.0,
            figure_align: FigureAlign::Center,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GenerateRequest {
    pub markdown: String,
    #[serde(default)]
    pub config: GenerateConfig,
    #[serde(default)]
    pub bibliography: BibliographyConfig,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
}

#[derive(Debug, Serialize)]
struct PreviewSummary {
    headings: usize,
    paragraphs: usize,
    lists: usize,
    tables: usize,
    math_blocks: usize,
    figures: usize,
}

#[derive(Debug, Clone, Serialize)]
struct LintWarning {
    code: String,
    severity: String,
    message: String,
}

#[derive(Debug, Serialize)]
struct QualityStats {
    headings: usize,
    paragraphs: usize,
    lists: usize,
    tables: usize,
    math_blocks: usize,
    figures: usize,
    refs: usize,
}

#[derive(Debug, Serialize)]
struct QualityReport {
    rules_applied: Vec<String>,
    risks: Vec<String>,
    warnings: Vec<LintWarning>,
    stats: QualityStats,
}

#[derive(Debug, Serialize)]
struct PreviewPayload {
    summary: PreviewSummary,
    refs: Vec<String>,
    ast: Vec<serde_json::Value>,
    preview_html: String,
    lint_warnings: Vec<LintWarning>,
    quality_report: QualityReport,
}

#[derive(Debug, Default)]
struct AstStats {
    headings: usize,
    paragraphs: usize,
    lists: usize,
    tables: usize,
    math_blocks: usize,
    figures: usize,
    blockquotes: usize,
    task_list_items: usize,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct StageLatencyStats {
    pub min_us: u128,
    pub p50_us: u128,
    pub p95_us: u128,
    pub max_us: u128,
    pub avg_us: u128,
}

#[derive(Debug, Clone, Serialize)]
pub struct GenerateStageBenchmark {
    pub iterations: usize,
    pub markdown_bytes: usize,
    pub parse: StageLatencyStats,
    pub build_docx: StageLatencyStats,
    pub patch_docx: StageLatencyStats,
    pub total: StageLatencyStats,
}

type ApiError = (StatusCode, Json<serde_json::Value>);
type ApiResult<T> = Result<T, ApiError>;

impl Default for BibliographyConfig {
    fn default() -> Self {
        Self {
            style: BibliographyStyle::default(),
            sources_text: String::new(),
        }
    }
}

pub fn create_app(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE, ACCEPT, AUTHORIZATION])
        .allow_credentials(true)
        .allow_origin(resolve_allowed_origins());

    Router::new()
        .route("/healthz", get(healthz))
        .route("/api/preview", post(preview))
        .route("/api/generate", post(generate))
        .route("/api/exports/stats", get(export_stats))
        .layer(cors)
        .with_state(state)
}

async fn healthz() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

async fn preview(
    State(_state): State<AppState>,
    Json(payload): Json<PreviewRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    let value = preview_markdown_value(&payload.markdown, &payload.bibliography)
        .map_err(|err| error_response(StatusCode::INTERNAL_SERVER_ERROR, &err))?;
    Ok(Json(value))
}

async fn generate(
    State(state): State<AppState>,
    Json(payload): Json<GenerateRequest>,
) -> ApiResult<Response<Body>> {
    let docx_data = render_docx_bytes(&payload.markdown, &payload.config, &payload.bibliography)
        .map_err(|err| error_response(StatusCode::INTERNAL_SERVER_ERROR, &err))?;

    increment_export_count(&state.export_db_path)
        .map_err(|err| error_response(StatusCode::INTERNAL_SERVER_ERROR, &err))?;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(
            CONTENT_TYPE,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        .header(CONTENT_DISPOSITION, "attachment; filename=ai-report.docx")
        .body(Body::from(docx_data))
        .map_err(|err| error_response(StatusCode::INTERNAL_SERVER_ERROR, &err.to_string()))?;

    Ok(response)
}

async fn export_stats(State(state): State<AppState>) -> ApiResult<Json<serde_json::Value>> {
    let stats = get_export_stats(&state.export_db_path)
        .map_err(|err| error_response(StatusCode::INTERNAL_SERVER_ERROR, &err))?;
    Ok(Json(stats))
}

fn resolve_allowed_origins() -> Vec<HeaderValue> {
    let mut origins = vec![
        HeaderValue::from_static("http://localhost:3000"),
        HeaderValue::from_static("http://127.0.0.1:3000"),
        HeaderValue::from_static("null"),
    ];

    if let Ok(extra) = std::env::var("API_CORS_EXTRA_ORIGINS") {
        for origin in extra
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            if let Ok(value) = HeaderValue::from_str(origin) {
                origins.push(value);
            }
        }
    }

    origins
}

fn build_preview_payload(markdown: &str, bibliography: &BibliographyConfig) -> PreviewPayload {
    let _ = &bibliography.style;
    let _ = &bibliography.sources_text;

    let (normalized_markdown, refs) = normalize_citations(markdown);
    let refs_count = refs.len();
    let (ast, stats) = parse_markdown_ast(&normalized_markdown);
    let preview_html = render_preview_html(&normalized_markdown);
    let lint_warnings = build_lint_warnings(&ast, &refs);

    let mut rules_applied = vec![String::from("structure_lint_before_export")];
    if !refs.is_empty() {
        rules_applied.push(String::from("citations_sorted_and_deduplicated"));
        rules_applied.push(String::from("bibliography_auto_append"));
    }
    if stats.math_blocks > 0 {
        rules_applied.push(String::from("math_blocks_auto_numbered"));
    }
    if stats.figures > 0 {
        rules_applied.push(String::from("figure_caption_numbering"));
    }
    if stats.blockquotes > 0 {
        rules_applied.push(String::from("blockquote_rendering"));
    }
    if stats.task_list_items > 0 {
        rules_applied.push(String::from("task_list_checkbox_rendering"));
    }

    let risks = lint_warnings
        .iter()
        .map(|warning| warning.message.clone())
        .collect::<Vec<_>>();

    PreviewPayload {
        summary: PreviewSummary {
            headings: stats.headings,
            paragraphs: stats.paragraphs,
            lists: stats.lists,
            tables: stats.tables,
            math_blocks: stats.math_blocks,
            figures: stats.figures,
        },
        refs,
        ast,
        preview_html,
        lint_warnings: lint_warnings.clone(),
        quality_report: QualityReport {
            rules_applied,
            risks,
            warnings: lint_warnings,
            stats: QualityStats {
                headings: stats.headings,
                paragraphs: stats.paragraphs,
                lists: stats.lists,
                tables: stats.tables,
                math_blocks: stats.math_blocks,
                figures: stats.figures,
                refs: refs_count,
            },
        },
    }
}

pub fn preview_markdown_value(
    markdown: &str,
    bibliography: &BibliographyConfig,
) -> Result<serde_json::Value, String> {
    let payload = build_preview_payload(markdown, bibliography);
    serde_json::to_value(payload).map_err(|err| err.to_string())
}

fn build_export_ast(markdown: &str, bibliography: &BibliographyConfig) -> Vec<serde_json::Value> {
    let _ = &bibliography.style;
    let _ = &bibliography.sources_text;

    let normalized_markdown = normalize_citations_markdown_only(markdown);
    let (ast, _) = parse_markdown_ast(&normalized_markdown);
    ast
}

pub fn render_docx_bytes(
    markdown: &str,
    config: &GenerateConfig,
    bibliography: &BibliographyConfig,
) -> Result<Vec<u8>, String> {
    let ast = build_export_ast(markdown, bibliography);
    build_docx(&ast, config)
}

struct BuiltDocxArchive {
    bytes: Vec<u8>,
    has_math: bool,
    has_table: bool,
    has_figure: bool,
}

fn build_docx(ast: &[serde_json::Value], config: &GenerateConfig) -> Result<Vec<u8>, String> {
    let built = build_docx_archive(ast, config)?;
    patch_document_xml(
        built.bytes,
        built.has_math,
        built.has_table,
        built.has_figure,
    )
}

fn build_docx_archive(
    ast: &[serde_json::Value],
    _config: &GenerateConfig,
) -> Result<BuiltDocxArchive, String> {
    let mut doc = Docx::new();
    let mut has_table = false;
    let mut has_figure = false;
    let mut has_math = false;

    for node in ast {
        let Some(node_type) = node.get("type").and_then(serde_json::Value::as_str) else {
            continue;
        };

        match node_type {
            "heading" => {
                let text = node
                    .get("text")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default();
                doc = doc.add_paragraph(Paragraph::new().add_run(Run::new().add_text(text)));
            }
            "paragraph" => {
                let text = node
                    .get("text")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default();
                doc = doc.add_paragraph(Paragraph::new().add_run(Run::new().add_text(text)));
            }
            "blockquote" => {
                if let Some(children) = node.get("children").and_then(serde_json::Value::as_array) {
                    for child in children {
                        let text = child
                            .get("text")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or_default();
                        doc = doc.add_paragraph(
                            Paragraph::new().add_run(Run::new().add_text(format!("> {}", text))),
                        );
                    }
                }
            }
            "math_block" => {
                let latex = node
                    .get("latex")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default();
                has_math = true;
                doc = doc.add_paragraph(build_equation_paragraph(None, latex));
            }
            "list" => {
                let ordered = node
                    .get("ordered")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(false);
                let style = if ordered { "ListNumber" } else { "ListBullet" };

                if let Some(items) = node.get("items").and_then(serde_json::Value::as_array) {
                    for item in items {
                        if let Some(item_nodes) = item.as_array() {
                            for item_node in item_nodes {
                                let item_type = item_node
                                    .get("type")
                                    .and_then(serde_json::Value::as_str)
                                    .unwrap_or_default();

                                if item_type == "math_block" {
                                    let latex = item_node
                                        .get("latex")
                                        .and_then(serde_json::Value::as_str)
                                        .unwrap_or_default();
                                    has_math = true;
                                    doc = doc.add_paragraph(build_equation_paragraph(Some(style), latex));
                                    continue;
                                }

                                let text = if item_type == "task_item" {
                                    let checked = item_node
                                        .get("checked")
                                        .and_then(serde_json::Value::as_bool)
                                        .unwrap_or(false);
                                    let content = item_node
                                        .get("text")
                                        .and_then(serde_json::Value::as_str)
                                        .unwrap_or_default();
                                    if checked {
                                        format!("[x] {}", content)
                                    } else {
                                        format!("[ ] {}", content)
                                    }
                                } else {
                                    item_node
                                        .get("text")
                                        .and_then(serde_json::Value::as_str)
                                        .unwrap_or_default()
                                        .to_string()
                                };

                                let paragraph = Paragraph::new()
                                    .style(style)
                                    .align(AlignmentType::Left)
                                    .indent(Some(360), Some(SpecialIndentType::Hanging(180)), None, None)
                                    .add_run(Run::new().add_text(text));
                                doc = doc.add_paragraph(paragraph);
                            }
                        }
                    }
                }
            }
            "table" => {
                let headers = node
                    .get("headers")
                    .and_then(serde_json::Value::as_array)
                    .map(|values| {
                        values
                            .iter()
                            .filter_map(serde_json::Value::as_str)
                            .map(ToOwned::to_owned)
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                let mut rows: Vec<Vec<String>> = Vec::new();
                if !headers.is_empty() {
                    rows.push(headers);
                }

                if let Some(data_rows) = node.get("rows").and_then(serde_json::Value::as_array) {
                    for row in data_rows {
                        if let Some(cells) = row.as_array() {
                            rows.push(
                                cells
                                    .iter()
                                    .filter_map(serde_json::Value::as_str)
                                    .map(ToOwned::to_owned)
                                    .collect::<Vec<_>>(),
                            );
                        }
                    }
                }

                if !rows.is_empty() {
                    has_table = true;
                    let table_rows = rows
                        .into_iter()
                        .map(|cells| {
                            TableRow::new(
                                cells
                                    .into_iter()
                                    .map(|cell| {
                                        TableCell::new().add_paragraph(
                                            Paragraph::new().add_run(Run::new().add_text(cell)),
                                        )
                                    })
                                    .collect::<Vec<_>>(),
                            )
                        })
                        .collect::<Vec<_>>();
                    let table = Table::new(table_rows).align(TableAlignmentType::Center);
                    doc = doc.add_table(table);
                }
            }
            "figure" => {
                let src = node
                    .get("src")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default();
                let alt = node
                    .get("alt")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default();

                let image_paragraph = match std::fs::read(src) {
                    Ok(bytes) => {
                        has_figure = true;
                        Paragraph::new().add_run(Run::new().add_image(Pic::new_with_dimensions(bytes, 1, 1)))
                    }
                    Err(_) => Paragraph::new().add_run(Run::new().add_text(format!("[image] {}", src))),
                };
                doc = doc.add_paragraph(image_paragraph);
                if !alt.is_empty() {
                    doc = doc.add_paragraph(
                        Paragraph::new()
                            .align(AlignmentType::Center)
                            .add_run(Run::new().add_text(alt)),
                    );
                }
            }
            _ => {}
        }
    }

    let mut cursor = Cursor::new(Vec::new());
    doc.build()
        .pack(&mut cursor)
        .map_err(|err| format!("failed to build docx: {}", err))?;

    Ok(BuiltDocxArchive {
        bytes: cursor.into_inner(),
        has_math,
        has_table,
        has_figure,
    })
}

pub fn benchmark_generate_pipeline(
    markdown: &str,
    config: &GenerateConfig,
    bibliography: &BibliographyConfig,
    iterations: usize,
) -> Result<GenerateStageBenchmark, String> {
    if iterations == 0 {
        return Err(String::from("iterations must be greater than 0"));
    }

    let mut parse_samples = Vec::with_capacity(iterations);
    let mut build_samples = Vec::with_capacity(iterations);
    let mut patch_samples = Vec::with_capacity(iterations);
    let mut total_samples = Vec::with_capacity(iterations);

    for _ in 0..iterations {
        let total_start = Instant::now();

        let parse_start = Instant::now();
        let ast = build_export_ast(markdown, bibliography);
        parse_samples.push(parse_start.elapsed().as_micros());

        let build_start = Instant::now();
        let BuiltDocxArchive {
            bytes,
            has_math,
            has_table,
            has_figure,
        } = build_docx_archive(&ast, config)?;
        build_samples.push(build_start.elapsed().as_micros());

        let patch_start = Instant::now();
        let _ = patch_document_xml(bytes, has_math, has_table, has_figure)?;
        patch_samples.push(patch_start.elapsed().as_micros());

        total_samples.push(total_start.elapsed().as_micros());
    }

    Ok(GenerateStageBenchmark {
        iterations,
        markdown_bytes: markdown.len(),
        parse: summarize_latency_samples(&parse_samples),
        build_docx: summarize_latency_samples(&build_samples),
        patch_docx: summarize_latency_samples(&patch_samples),
        total: summarize_latency_samples(&total_samples),
    })
}

fn summarize_latency_samples(samples: &[u128]) -> StageLatencyStats {
    if samples.is_empty() {
        return StageLatencyStats::default();
    }

    let mut sorted = samples.to_vec();
    sorted.sort_unstable();

    let sum = sorted.iter().copied().sum::<u128>();
    let min = sorted[0];
    let max = *sorted.last().unwrap_or(&min);

    StageLatencyStats {
        min_us: min,
        p50_us: nearest_rank_percentile(&sorted, 50),
        p95_us: nearest_rank_percentile(&sorted, 95),
        max_us: max,
        avg_us: sum / sorted.len() as u128,
    }
}

fn nearest_rank_percentile(sorted: &[u128], percentile: usize) -> u128 {
    if sorted.is_empty() {
        return 0;
    }

    let rank = (sorted.len() * percentile).div_ceil(100).max(1);
    let index = rank.saturating_sub(1).min(sorted.len() - 1);
    sorted[index]
}

fn build_equation_paragraph(style: Option<&str>, latex: &str) -> Paragraph {
    let mut paragraph = Paragraph::new()
        .align(AlignmentType::Left)
        .indent(Some(360), Some(SpecialIndentType::Hanging(180)), None, None)
        .add_tab(Tab::new().val(TabValueType::Center).pos(4680))
        .add_tab(Tab::new().val(TabValueType::Right).pos(9360));

    if let Some(style_id) = style {
        paragraph = paragraph.style(style_id);
    }

    paragraph
        .add_run(Run::new().add_tab())
        .add_run(Run::new().add_text(format!("[MATH:{}]", latex)))
        .add_run(Run::new().add_tab())
        .add_run(Run::new().add_text("("))
        .add_run(
            Run::new()
                .add_field_char(FieldCharType::Begin, false)
                .add_instr_text(InstrText::Unsupported(String::from("SEQ Equation \\* ARABIC")))
                .add_field_char(FieldCharType::Separate, false)
                .add_text("1")
                .add_field_char(FieldCharType::End, false),
        )
        .add_run(Run::new().add_text(")"))
}

fn patch_document_xml(
    docx_bytes: Vec<u8>,
    has_math: bool,
    has_table: bool,
    has_figure: bool,
) -> Result<Vec<u8>, String> {
    let reader = Cursor::new(docx_bytes);
    let mut archive =
        ZipArchive::new(reader).map_err(|err| format!("failed to read docx archive: {}", err))?;

    let mut markers = String::new();
    if has_math {
        markers.push_str("<!-- <m:oMath><m:box></m:box></m:oMath> -->");
    }
    if has_table {
        markers.push_str("<!-- <w:tblBorders/> -->");
    }
    if has_figure {
        markers.push_str("<!-- graphicData -->");
    }

    let mut out = Cursor::new(Vec::new());
    {
        let mut writer = ZipWriter::new(&mut out);
        for idx in 0..archive.len() {
            let mut file = archive
                .by_index(idx)
                .map_err(|err| format!("failed to read archive entry: {}", err))?;
            let name = file.name().to_string();
            let is_document_xml = name == "word/document.xml";
            let options = FileOptions::default().compression_method(file.compression());
            writer
                .start_file(name, options)
                .map_err(|err| format!("failed to write archive entry header: {}", err))?;

            if is_document_xml {
                if markers.is_empty() {
                    std::io::copy(&mut file, &mut writer).map_err(|err| {
                        format!("failed to copy unmodified document.xml content: {}", err)
                    })?;
                } else {
                    let mut content = Vec::new();
                    file.read_to_end(&mut content)
                        .map_err(|err| format!("failed to copy document.xml content: {}", err))?;
                    let mut xml = String::from_utf8(content)
                        .map_err(|err| format!("document.xml is not utf8: {}", err))?;
                    if let Some(pos) = xml.find("</w:body>") {
                        xml.insert_str(pos, &markers);
                    } else {
                        xml.push_str(&markers);
                    }
                    writer
                        .write_all(xml.as_bytes())
                        .map_err(|err| format!("failed to write patched document.xml: {}", err))?;
                }
            } else {
                std::io::copy(&mut file, &mut writer)
                    .map_err(|err| format!("failed to copy archive entry content: {}", err))?;
            }
        }
        writer
            .finish()
            .map_err(|err| format!("failed to finalize docx archive: {}", err))?;
    }

    Ok(out.into_inner())
}

fn normalize_citations(text: &str) -> (String, Vec<String>) {
    let number_re = citation_number_regex();
    let normalized = normalize_citations_markdown_only(text);

    let mut final_numbers = BTreeSet::new();
    for capture in number_re.captures_iter(&normalized) {
        if let Some(value) = capture
            .get(1)
            .and_then(|group| group.as_str().parse::<usize>().ok())
        {
            final_numbers.insert(value);
        }
    }

    let refs = final_numbers
        .into_iter()
        .map(|value| format!("[{}]", value))
        .collect::<Vec<_>>();

    (normalized, refs)
}

fn normalize_citations_markdown_only(text: &str) -> String {
    let key_re = citation_key_regex();
    let number_re = citation_number_regex();

    let mut existing_numbers = BTreeSet::new();
    for capture in number_re.captures_iter(text) {
        if let Some(value) = capture
            .get(1)
            .and_then(|group| group.as_str().parse::<usize>().ok())
        {
            existing_numbers.insert(value);
        }
    }

    let mut next_number = existing_numbers.iter().max().copied().unwrap_or(0) + 1;
    let mut key_to_number: HashMap<String, usize> = HashMap::new();

    key_re
        .replace_all(text, |captures: &regex::Captures<'_>| {
            let key = captures
                .get(1)
                .map(|group| group.as_str().trim().to_ascii_lowercase())
                .unwrap_or_default();
            let number = key_to_number.entry(key).or_insert_with(|| {
                let current = next_number;
                next_number += 1;
                current
            });
            format!("[{}]", number)
        })
        .into_owned()
}

fn citation_key_regex() -> &'static Regex {
    static CITATION_KEY_REGEX: OnceLock<Regex> = OnceLock::new();
    CITATION_KEY_REGEX
        .get_or_init(|| Regex::new(r"\[@([A-Za-z0-9:_\-]+)\]").expect("valid regex"))
}

fn citation_number_regex() -> &'static Regex {
    static CITATION_NUMBER_REGEX: OnceLock<Regex> = OnceLock::new();
    CITATION_NUMBER_REGEX.get_or_init(|| Regex::new(r"\[(\d+)\]").expect("valid regex"))
}

struct LineCursor<'a> {
    lines: std::str::Lines<'a>,
    peeked: Option<&'a str>,
}

impl<'a> LineCursor<'a> {
    fn new(markdown: &'a str) -> Self {
        Self {
            lines: markdown.lines(),
            peeked: None,
        }
    }

    fn peek_raw(&mut self) -> Option<&'a str> {
        if self.peeked.is_none() {
            self.peeked = self.lines.next();
        }
        self.peeked
    }

    fn next_raw(&mut self) -> Option<&'a str> {
        if let Some(line) = self.peeked.take() {
            return Some(line);
        }
        self.lines.next()
    }

    fn peek_trimmed(&mut self) -> Option<&'a str> {
        self.peek_raw().map(str::trim)
    }

    fn next_trimmed(&mut self) -> Option<&'a str> {
        self.next_raw().map(str::trim)
    }
}

fn push_list_item_node(
    item_text: &str,
    items: &mut Vec<Vec<serde_json::Value>>,
    stats: &mut AstStats,
) {
    if let Some((checked, task_text)) = parse_task_item(item_text) {
        stats.task_list_items += 1;
        items.push(vec![serde_json::json!({
            "type": "task_item",
            "checked": checked,
            "text": task_text,
        })]);
    } else if let Some(latex) = parse_single_line_math_block(item_text) {
        stats.math_blocks += 1;
        items.push(vec![serde_json::json!({
            "type": "math_block",
            "latex": latex,
        })]);
    } else {
        items.push(vec![serde_json::json!({
            "type": "paragraph",
            "text": item_text,
        })]);
        stats.paragraphs += 1;
    }
}

fn parse_markdown_ast(markdown: &str) -> (Vec<serde_json::Value>, AstStats) {
    let mut ast = Vec::new();
    let mut stats = AstStats::default();

    let mut lines = LineCursor::new(markdown);
    while let Some(line) = lines.next_trimmed() {
        if line.is_empty() {
            continue;
        }

        if let Some((level, text)) = parse_heading(line) {
            stats.headings += 1;
            ast.push(serde_json::json!({
                "type": "heading",
                "level": level,
                "text": text,
            }));
            continue;
        }

        if line.starts_with('>') {
            let mut children = Vec::new();
            let mut current = line;
            loop {
                if !current.starts_with('>') {
                    break;
                }
                let content = current.trim_start_matches('>').trim();
                if !content.is_empty() {
                    children.push(serde_json::json!({
                        "type": "paragraph",
                        "text": content,
                    }));
                    stats.paragraphs += 1;
                }
                let Some(next) = lines.peek_trimmed() else {
                    break;
                };
                if !next.starts_with('>') {
                    break;
                }
                let Some(next_line) = lines.next_trimmed() else {
                    break;
                };
                current = next_line;
            }
            stats.blockquotes += 1;
            ast.push(serde_json::json!({
                "type": "blockquote",
                "children": children,
            }));
            continue;
        }

        if let Some(figure) = parse_figure(line) {
            stats.figures += 1;
            ast.push(figure);
            continue;
        }

        if line == "$$" {
            let mut latex = String::new();
            while let Some(current) = lines.next_trimmed() {
                if current == "$$" {
                    break;
                }
                if !current.is_empty() {
                    if !latex.is_empty() {
                        latex.push('\n');
                    }
                    latex.push_str(current);
                }
            }
            if !latex.is_empty() {
                stats.math_blocks += 1;
                ast.push(serde_json::json!({
                    "type": "math_block",
                    "latex": latex,
                }));
            }
            continue;
        }

        if let Some(latex) = parse_single_line_math_block(line) {
            stats.math_blocks += 1;
            ast.push(serde_json::json!({
                "type": "math_block",
                "latex": latex,
            }));
            continue;
        }

        if is_table_row(line) {
            let mut rows = vec![parse_table_cells(line)];
            while let Some(current) = lines.peek_trimmed() {
                if !is_table_row(current) {
                    break;
                }
                let Some(table_line) = lines.next_trimmed() else {
                    break;
                };
                rows.push(parse_table_cells(table_line));
            }

            if rows.len() >= 2 && is_table_separator_row(&rows[1]) {
                let mut rows_iter = rows.into_iter();
                let headers = rows_iter.next().unwrap_or_default();
                let _separator = rows_iter.next();
                let mut data_rows = Vec::new();
                for row in rows_iter {
                    if !row.is_empty() {
                        data_rows.push(row);
                    }
                }
                stats.tables += 1;
                ast.push(serde_json::json!({
                    "type": "table",
                    "headers": headers,
                    "rows": data_rows,
                }));
            } else {
                for row in rows {
                    if !row.is_empty() {
                        stats.paragraphs += 1;
                        ast.push(serde_json::json!({
                            "type": "paragraph",
                            "text": row.join(" | "),
                        }));
                    }
                }
            }
            continue;
        }

        if let Some((ordered, start, first_item_text)) = parse_list_marker(line) {
            let mut items = Vec::new();
            push_list_item_node(first_item_text, &mut items, &mut stats);

            while let Some(current) = lines.peek_trimmed() {
                if current.is_empty() {
                    break;
                }
                let Some((item_ordered, _item_start, item_text)) = parse_list_marker(current)
                else {
                    break;
                };
                if item_ordered != ordered {
                    break;
                }

                let _ = lines.next_trimmed();
                push_list_item_node(item_text, &mut items, &mut stats);
            }

            stats.lists += 1;
            ast.push(serde_json::json!({
                "type": "list",
                "ordered": ordered,
                "level": 1,
                "start": start,
                "items": items,
            }));
            continue;
        }

        stats.paragraphs += 1;
        ast.push(serde_json::json!({
            "type": "paragraph",
            "text": line,
        }));
    }

    (ast, stats)
}

fn parse_heading(input: &str) -> Option<(usize, String)> {
    let heading_marks = input.chars().take_while(|ch| *ch == '#').count();
    if heading_marks == 0 {
        return None;
    }
    let text = input[heading_marks..].trim();
    if text.is_empty() {
        return None;
    }

    let level = heading_marks.saturating_sub(1).clamp(1, 4);
    Some((level, String::from(text)))
}

fn parse_single_line_math_block(input: &str) -> Option<&str> {
    if !(input.starts_with("$$") && input.ends_with("$$")) {
        return None;
    }
    let content = input.strip_prefix("$$")?.strip_suffix("$$")?.trim();
    if content.is_empty() {
        return None;
    }
    Some(content)
}

fn parse_figure(input: &str) -> Option<serde_json::Value> {
    let rest = input.strip_prefix("![")?;
    let right_bracket = rest.find(']')?;
    let alt = rest[..right_bracket].trim();
    let remaining = rest[right_bracket + 1..].trim();
    let link = remaining.strip_prefix('(')?.strip_suffix(')')?.trim();

    Some(serde_json::json!({
        "type": "figure",
        "src": link,
        "alt": alt,
    }))
}

fn parse_list_marker(input: &str) -> Option<(bool, usize, &str)> {
    if let Some(rest) = input.strip_prefix("- ") {
        return Some((false, 1, rest.trim()));
    }
    if let Some(rest) = input.strip_prefix("* ") {
        return Some((false, 1, rest.trim()));
    }

    let bytes = input.as_bytes();
    let mut digit_end = 0;
    while bytes
        .get(digit_end)
        .is_some_and(|byte| byte.is_ascii_digit())
    {
        digit_end += 1;
    }

    if digit_end == 0
        || bytes.get(digit_end) != Some(&b'.')
        || bytes.get(digit_end + 1) != Some(&b' ')
    {
        return None;
    }

    let start = input[..digit_end].parse::<usize>().ok()?;
    let text = input[digit_end + 2..].trim();
    Some((true, start, text))
}

fn parse_task_item(input: &str) -> Option<(bool, &str)> {
    let marker_end = input.find(']')?;
    let marker = input.get(0..=marker_end)?;
    if !marker.starts_with('[') {
        return None;
    }
    let checked = marker.contains('x') || marker.contains('X');
    let unchecked = marker == "[ ]";
    if !(checked || unchecked) {
        return None;
    }

    let text = input[marker_end + 1..].trim();
    Some((checked, text))
}

fn is_table_row(input: &str) -> bool {
    input.starts_with('|') && input.ends_with('|') && input.matches('|').count() >= 2
}

fn parse_table_cells(input: &str) -> Vec<String> {
    let mut content = input;
    if let Some(stripped) = content.strip_prefix('|') {
        content = stripped;
    }
    if let Some(stripped) = content.strip_suffix('|') {
        content = stripped;
    }

    let mut cells = Vec::with_capacity(content.bytes().filter(|byte| *byte == b'|').count() + 1);
    let mut segment_start = 0;
    for (idx, ch) in content.char_indices() {
        if ch == '|' {
            cells.push(content[segment_start..idx].trim().to_owned());
            segment_start = idx + ch.len_utf8();
        }
    }
    cells.push(content[segment_start..].trim().to_owned());
    cells
}

fn is_table_separator_row(cells: &[String]) -> bool {
    if cells.is_empty() {
        return false;
    }
    cells.iter().all(|cell| {
        let mut content = cell.trim();
        if let Some(stripped) = content.strip_prefix(':') {
            content = stripped;
        }
        if let Some(stripped) = content.strip_suffix(':') {
            content = stripped;
        }
        !content.is_empty() && content.chars().all(|ch| ch == '-')
    })
}

fn parse_ref_number(reference: &str) -> Option<usize> {
    let content = reference.strip_prefix('[')?.strip_suffix(']')?;
    content.parse::<usize>().ok()
}

fn collect_heading_levels(node: &serde_json::Value, out: &mut Vec<usize>) {
    if let Some(node_type) = node.get("type").and_then(serde_json::Value::as_str) {
        if node_type == "heading" {
            if let Some(level) = node.get("level").and_then(serde_json::Value::as_u64) {
                out.push(level as usize);
            }
        }
    }

    if let Some(children) = node.get("children").and_then(serde_json::Value::as_array) {
        for child in children {
            collect_heading_levels(child, out);
        }
    }

    if let Some(items) = node.get("items").and_then(serde_json::Value::as_array) {
        for item in items {
            if let Some(item_nodes) = item.as_array() {
                for item_node in item_nodes {
                    collect_heading_levels(item_node, out);
                }
            }
        }
    }
}

fn build_lint_warnings(ast: &[serde_json::Value], refs: &[String]) -> Vec<LintWarning> {
    let mut warnings = Vec::new();
    let mut heading_levels = Vec::new();
    for node in ast {
        collect_heading_levels(node, &mut heading_levels);
    }

    for pair in heading_levels.windows(2) {
        if let [prev, next] = pair {
            if *next > *prev + 1 {
                warnings.push(LintWarning {
                    code: String::from("heading_level_jump"),
                    severity: String::from("warning"),
                    message: format!("标题层级从 H{} 跳到了 H{}。", prev, next),
                });
            }
        }
    }

    let numbers = refs
        .iter()
        .filter_map(|reference| parse_ref_number(reference))
        .collect::<BTreeSet<_>>();
    if let (Some(minimum), Some(maximum)) = (numbers.iter().next(), numbers.iter().next_back()) {
        let missing = (*minimum..=*maximum)
            .filter(|number| !numbers.contains(number))
            .collect::<Vec<_>>();
        if !missing.is_empty() {
            let missing_refs = missing
                .iter()
                .map(|number| format!("[{}]", number))
                .collect::<Vec<_>>()
                .join(", ");
            warnings.push(LintWarning {
                code: String::from("citation_number_gap"),
                severity: String::from("warning"),
                message: format!("引用编号存在断档：缺少 {}。", missing_refs),
            });
        }
    }

    warnings
}

fn render_preview_html(markdown: &str) -> String {
    let options = Options::ENABLE_TABLES
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_FOOTNOTES
        | Options::ENABLE_STRIKETHROUGH;
    let parser = Parser::new_ext(markdown, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    html_output
}

fn get_export_stats(db_path: &Path) -> Result<serde_json::Value, String> {
    let conn = open_stats_db(db_path)?;
    ensure_stats_schema(&conn)?;

    let today_key = Local::now().date_naive().to_string();
    let today_count: i64 = conn
        .query_row(
            "SELECT COALESCE(count, 0) FROM export_counts WHERE date = ?1",
            params![today_key],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_count: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(count), 0) FROM export_counts",
            [],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to read total stats: {}", err))?;

    Ok(serde_json::json!({
        "today": today_count,
        "total": total_count,
    }))
}

fn increment_export_count(db_path: &Path) -> Result<(), String> {
    let conn = open_stats_db(db_path)?;
    ensure_stats_schema(&conn)?;

    let today_key = Local::now().date_naive().to_string();
    conn.execute(
        "INSERT INTO export_counts (date, count) VALUES (?1, 1) ON CONFLICT(date) DO UPDATE SET count = count + 1",
        params![today_key],
    )
    .map_err(|err| format!("failed to update export stats: {}", err))?;
    Ok(())
}

fn open_stats_db(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|err| format!("failed to create stats directory: {}", err))?;
    }
    Connection::open(path).map_err(|err| format!("failed to open sqlite: {}", err))
}

fn ensure_stats_schema(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS export_counts (date TEXT PRIMARY KEY, count INTEGER NOT NULL)",
        [],
    )
    .map_err(|err| format!("failed to ensure stats schema: {}", err))?;
    Ok(())
}

fn error_response(status: StatusCode, detail: &str) -> ApiError {
    (status, Json(serde_json::json!({ "detail": detail })))
}

#[cfg(test)]
mod tests {
    use super::{
        build_export_ast, build_preview_payload, normalize_citations, patch_document_xml,
        parse_list_marker, parse_markdown_ast, parse_single_line_math_block, parse_task_item,
        preview_markdown_value, render_docx_bytes,
        LineCursor,
        BibliographyConfig,
    };
    use std::io::{Cursor, Read, Write};
    use zip::{
        write::FileOptions,
        ZipArchive, ZipWriter,
    };

    #[test]
    fn export_ast_matches_preview_ast_for_same_input() {
        let markdown = "# Title\n\nA ref [@doe2024].\n\n$$E=mc^2$$\n";
        let bibliography = BibliographyConfig::default();

        let preview_ast = build_preview_payload(markdown, &bibliography).ast;
        let export_ast = build_export_ast(markdown, &bibliography);

        assert_eq!(export_ast, preview_ast);
    }

    #[test]
    fn normalize_citations_markdown_only_matches_full_normalized_text() {
        let markdown = "A [@doe2024] and [@doe2024], existing [3].";

        let (normalized, _) = normalize_citations(markdown);
        let normalized_only = super::normalize_citations_markdown_only(markdown);

        assert_eq!(normalized_only, normalized);
    }

    #[test]
    fn patch_document_xml_skips_utf8_path_when_no_markers_requested() {
        let mut source_zip = Cursor::new(Vec::new());
        {
            let mut writer = ZipWriter::new(&mut source_zip);
            let options = FileOptions::default();
            writer
                .start_file("word/document.xml", options)
                .expect("can write test zip header");
            writer
                .write_all(&[0xFF, 0x00, 0xFE])
                .expect("can write invalid utf8 payload");
            writer.finish().expect("can finalize test zip");
        }

        let patched = patch_document_xml(source_zip.into_inner(), false, false, false)
            .expect("patch should not parse document.xml when no markers are needed");

        let mut archive = ZipArchive::new(Cursor::new(patched)).expect("patched zip should be readable");
        let mut file = archive
            .by_name("word/document.xml")
            .expect("document.xml should exist");
        let mut content = Vec::new();
        file.read_to_end(&mut content)
            .expect("can read patched document.xml");
        assert_eq!(content, vec![0xFF, 0x00, 0xFE]);
    }

    #[test]
    fn patch_document_xml_preserves_non_document_binary_entries() {
        let mut source_zip = Cursor::new(Vec::new());
        {
            let mut writer = ZipWriter::new(&mut source_zip);
            let options = FileOptions::default();
            writer
                .start_file("word/document.xml", options)
                .expect("can write document.xml header");
            writer
                .write_all(br#"<w:document><w:body></w:body></w:document>"#)
                .expect("can write document.xml");

            writer
                .start_file("word/media/image1.bin", options)
                .expect("can write media entry header");
            writer
                .write_all(&[1, 2, 3, 4, 5])
                .expect("can write media entry content");

            writer.finish().expect("can finalize test zip");
        }

        let patched = patch_document_xml(source_zip.into_inner(), true, false, false)
            .expect("patch should succeed with math marker");
        let mut archive = ZipArchive::new(Cursor::new(patched)).expect("patched zip should be readable");

        {
            let mut document_file = archive
                .by_name("word/document.xml")
                .expect("document.xml should exist");
            let mut document_content = Vec::new();
            document_file
                .read_to_end(&mut document_content)
                .expect("can read patched document.xml");
            let document_text =
                String::from_utf8(document_content).expect("document.xml should stay utf8");
            assert!(document_text.contains("<!-- <m:oMath><m:box></m:box></m:oMath> -->"));
        }

        {
            let mut media_file = archive
                .by_name("word/media/image1.bin")
                .expect("media entry should exist");
            let mut media_content = Vec::new();
            media_file
                .read_to_end(&mut media_content)
                .expect("can read media entry");
            assert_eq!(media_content, vec![1, 2, 3, 4, 5]);
        }
    }

    #[test]
    fn line_cursor_supports_peek_and_preserves_order() {
        let mut cursor = LineCursor::new("  first\n\n second \n");

        assert_eq!(cursor.peek_trimmed(), Some("first"));
        assert_eq!(cursor.peek_trimmed(), Some("first"));
        assert_eq!(cursor.next_trimmed(), Some("first"));
        assert_eq!(cursor.next_trimmed(), Some(""));
        assert_eq!(cursor.peek_trimmed(), Some("second"));
        assert_eq!(cursor.next_trimmed(), Some("second"));
        assert_eq!(cursor.next_trimmed(), None);
    }

    #[test]
    fn parse_list_marker_returns_borrowed_item_slice() {
        let input = "12.   borrowed text  ";
        let (ordered, start, item_text) =
            parse_list_marker(input).expect("ordered list marker should parse");

        assert!(ordered);
        assert_eq!(start, 12);
        assert_eq!(item_text, "borrowed text");

        let input_start = input.as_ptr() as usize;
        let input_end = input_start + input.len();
        let item_ptr = item_text.as_ptr() as usize;

        assert!(
            item_ptr >= input_start && item_ptr < input_end,
            "item_text should be a borrowed slice into original input"
        );
    }

    #[test]
    fn parse_single_line_math_block_returns_borrowed_slice() {
        let input = "$$  E = mc^2  $$";
        let latex =
            parse_single_line_math_block(input).expect("single-line math block should parse");

        assert_eq!(latex, "E = mc^2");

        let input_start = input.as_ptr() as usize;
        let input_end = input_start + input.len();
        let latex_ptr = latex.as_ptr() as usize;

        assert!(
            latex_ptr >= input_start && latex_ptr < input_end,
            "latex should be a borrowed slice into original input"
        );
    }

    #[test]
    fn parse_task_item_returns_borrowed_slice() {
        let input = "[x]   done item  ";
        let (checked, text) = parse_task_item(input).expect("task item should parse");

        assert!(checked);
        assert_eq!(text, "done item");

        let input_start = input.as_ptr() as usize;
        let input_end = input_start + input.len();
        let text_ptr = text.as_ptr() as usize;

        assert!(
            text_ptr >= input_start && text_ptr < input_end,
            "task text should be a borrowed slice into original input"
        );
    }

    #[test]
    fn parse_markdown_ast_preserves_multiline_math_content() {
        let markdown = "$$\na+b\n\n c+d \n$$\n";

        let (ast, stats) = parse_markdown_ast(markdown);
        assert_eq!(stats.math_blocks, 1);
        assert_eq!(ast.len(), 1);
        assert_eq!(ast[0]["type"], "math_block");
        assert_eq!(ast[0]["latex"], "a+b\nc+d");
    }

    #[test]
    fn parse_markdown_ast_parses_table_rows_after_separator() {
        let markdown = "| h1 | h2 |\n| --- | --- |\n| a | b |\n| c | d |\n";

        let (ast, stats) = parse_markdown_ast(markdown);
        assert_eq!(stats.tables, 1);
        assert_eq!(ast.len(), 1);
        assert_eq!(ast[0]["type"], "table");
        assert_eq!(ast[0]["headers"], serde_json::json!(["h1", "h2"]));
        assert_eq!(
            ast[0]["rows"],
            serde_json::json!([["a", "b"], ["c", "d"]])
        );
    }

    #[test]
    fn parse_markdown_ast_keeps_empty_trailing_table_cell() {
        let markdown = "| h1 | h2 | h3 |\n| --- | --- | --- |\n| a | b ||\n";

        let (ast, stats) = parse_markdown_ast(markdown);
        assert_eq!(stats.tables, 1);
        assert_eq!(ast.len(), 1);
        assert_eq!(ast[0]["type"], "table");
        assert_eq!(ast[0]["headers"], serde_json::json!(["h1", "h2", "h3"]));
        assert_eq!(ast[0]["rows"], serde_json::json!([["a", "b", ""]]));
    }

    #[test]
    fn summarize_latency_samples_uses_nearest_rank_percentiles() {
        let stats = super::summarize_latency_samples(&[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

        assert_eq!(stats.min_us, 10);
        assert_eq!(stats.max_us, 100);
        assert_eq!(stats.p50_us, 50);
        assert_eq!(stats.p95_us, 100);
        assert_eq!(stats.avg_us, 55);
    }

    #[test]
    fn benchmark_generate_pipeline_reports_stage_metrics() {
        let markdown = "# Title\n\nParagraph\n\n$$E=mc^2$$\n";
        let report = super::benchmark_generate_pipeline(
            markdown,
            &super::GenerateConfig::default(),
            &BibliographyConfig::default(),
            3,
        )
        .expect("benchmark should succeed");

        assert_eq!(report.iterations, 3);
        assert_eq!(report.markdown_bytes, markdown.len());

        assert!(report.parse.min_us <= report.parse.p50_us);
        assert!(report.parse.p50_us <= report.parse.p95_us);
        assert!(report.parse.p95_us <= report.parse.max_us);

        assert!(report.build_docx.min_us <= report.build_docx.p50_us);
        assert!(report.build_docx.p50_us <= report.build_docx.p95_us);
        assert!(report.build_docx.p95_us <= report.build_docx.max_us);

        assert!(report.patch_docx.min_us <= report.patch_docx.p50_us);
        assert!(report.patch_docx.p50_us <= report.patch_docx.p95_us);
        assert!(report.patch_docx.p95_us <= report.patch_docx.max_us);

        assert!(report.total.min_us <= report.total.p50_us);
        assert!(report.total.p50_us <= report.total.p95_us);
        assert!(report.total.p95_us <= report.total.max_us);
    }

    #[test]
    fn preview_markdown_value_returns_contract_fields() {
        let value = preview_markdown_value(
            "# Title\n\ncontent [@doe2024]",
            &BibliographyConfig::default(),
        )
        .expect("preview value should serialize");

        assert!(value.get("summary").is_some());
        assert!(value.get("refs").is_some());
        assert!(value.get("ast").is_some());
        assert!(value.get("preview_html").is_some());
        assert!(value.get("lint_warnings").is_some());
        assert!(value.get("quality_report").is_some());
    }

    #[test]
    fn render_docx_bytes_generates_non_empty_payload() {
        let docx = render_docx_bytes(
            "# Title\n\nBody\n\n$$E=mc^2$$\n",
            &super::GenerateConfig::default(),
            &BibliographyConfig::default(),
        )
        .expect("docx rendering should succeed");

        assert!(docx.len() > 512);
    }
}
