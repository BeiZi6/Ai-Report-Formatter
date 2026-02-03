# DOCX Formatting Enhancements Design

Date: 2026-02-03

## Context
The Markdown-to-Docx pipeline already parses headings, lists, tables, and math into an AST, and renders via `formatter/docx_builder.py`. Inline math works, but block math lacks equation numbering. Lists render using default Word list styles and are not aligned with the desired visual layout. Tables render with full grid borders; the desired style is three-line tables (top line, header-bottom line, bottom line; no vertical borders).

## Goals
- Render block math centered with right-aligned automatic equation numbers (Word auto-numbering).
- Improve ordered/unordered list appearance and align numbering/text to match the provided reference.
- Default tables to three-line table style (no vertical borders, only top/header/bottom lines).

## Non-Goals
- No changes to Markdown parsing or AST structure.
- No new configuration UI for these formatting rules in this iteration.
- No template-based rendering or external docx engines.

## Decisions
1) **Block math numbering**
- Render each `math_block` in its own paragraph.
- Center the formula content, and insert a right-aligned tab stop.
- Append a `SEQ Equation` field for automatic numbering (displayed as `(1)`, `(2)`, ...).
- If OMML conversion fails, fall back to literal LaTeX text without numbering.

2) **List formatting**
- Keep existing AST list structure.
- For ordered lists, use multilevel numbering (1, 1.1, 1.1.1...) based on nesting level.
- For unordered lists, vary bullet glyphs by depth (filled circle, hollow circle, square).
- Enforce consistent `left_indent` and `first_line_indent` per nesting level so numbering/bullets align with text.

3) **Three-line table style**
- Remove all vertical borders and internal horizontal borders.
- Keep top and bottom borders for the whole table.
- Add a bottom border to the header row to create the header separator line.

## Implementation Plan (Files)
- `apps/formatter/formatter/docx_builder.py`
  - Add helper to insert equation numbering using OXML (`SEQ Equation`).
  - Add list paragraph indentation rules based on nesting level and list type.
  - Update table rendering to apply three-line table borders.
- `tests/formatter/test_docx_styles.py`
  - Assert block math paragraphs are centered and contain equation numbering field.
  - Assert list indentation and numbering level are applied.
  - Assert table borders reflect three-line style.

## Error Handling
- If math conversion fails, output LaTeX text as plain run (no crash).
- Table border application errors do not block document generation; fall back to default table style.

## Testing Strategy
- Add unit tests that inspect generated docx XML for:
  - `SEQ Equation` field in math block paragraphs.
  - `w:ilvl`/`w:numPr` for ordered list items and expected indent values.
  - `w:tblBorders` contains only top/bottom lines and header bottom border.
- Manual verification on a sample Markdown document to ensure visual parity.

## Open Questions
- Exact indent sizes for list levels (define in code; adjust after visual check).
- Bullet glyph choice mapping by nesting level (validate with sample output).
