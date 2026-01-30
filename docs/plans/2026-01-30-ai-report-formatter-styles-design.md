# AI Report Formatter - Docx Styles Design

## Overview
Add Word style writing to the formatter pipeline so exported .docx reflects user-configured fonts, sizes, spacing, margins, alignment, and page number.

## Scope (This Iteration)
- Write body and heading styles into the docx.
- Support H1–H4 with per-level configuration.
- Apply paragraph alignment, spacing, and first-line indent.
- Apply page margins and footer page number (center).

## Data Model
Extend `FormatConfig` to include:
- `BodyStyle`: cn_font, en_font, body_size_pt, line_spacing, para_before_pt, para_after_pt, first_line_indent, justify.
- `HeadingStyle[1..4]`: font, size_pt, line_spacing, para_before_pt, para_after_pt, align.

Notes:
- First-line indent is calculated as “2 * body_size_pt”.
- Heading fonts are per-level (no CN/EN split for headings).

## Pipeline Changes
`docx_builder.build_docx(ast, output_path, config)` will:
1) Set page margins: top/bottom 2.54cm, left/right 3.18cm.
2) Insert page number (footer, centered) using Word field `PAGE`.
3) Apply styles: update/define `Normal` and `Heading 1–4` for font, size, spacing, alignment.
4) Render AST using these styles, with paragraph-level overrides for indent/justify when needed.

## Error Handling
- If style writing fails, fall back to paragraph-level properties and continue export.
- If page number insertion fails, skip page number and continue export.

## Testing Strategy
1) **Unit tests (docx_builder):** export docx with custom config, re-open with python-docx, verify:
   - `Normal` and `Heading 1–4` styles exist.
   - Style font/size/spacing fields match config.
   - Body paragraphs are justified; first-line indent equals 2 * body size.
   - Margins match expected cm values.
2) **Fallback test:** monkeypatch style-setting to raise; export should still succeed.
3) **XML check:** ensure footer contains `PAGE` field.

## Out of Scope
- LaTeX/References rendering into docx (separate task).
- Table/list/blockquote rendering improvements.
