# Markdown to DOCX Rich Feature Design

**Goal:** Extend the formatter so Markdown features (italic/bold-italic, strikethrough, highlight, superscript/subscript, lists, tables, and math) render correctly in exported DOCX.

## Architecture
- Keep the existing pipeline: `format_markdown(text)` -> `parse_markdown()` -> AST -> `build_docx(ast)`.
- Extend the Markdown parser to emit richer AST nodes for lists, tables, and math, and inline runs with style flags.
- Extend DOCX rendering to translate new AST nodes into Word paragraphs, list styles, tables, and OMML math.

## Parser Changes
- Use `markdown-it-py` with rules enabled for tables and strikethrough.
- Use `mdit_py_plugins.dollarmath` for `$...$` and `$$...$$` tokens.
- Add inline marker handling for `==highlight==`, `^sup^`, and `~sub~` inside text tokens to avoid extra parser plugins.
- Output AST nodes:
  - `heading`, `paragraph` (with `runs`)
  - `list` with `items` and `level`
  - `table` with `header`, `rows`, and `align`
  - `math_block`
- Horizontal rules (`---`) are ignored per requirement.

## DOCX Rendering
- Inline run mapping:
  - `bold`, `italic`, `strike`, `highlight`, `superscript`, `subscript`, `code` -> Word run formatting.
- Lists:
  - Use built-in list styles (`List Bullet`, `List Bullet 2`, `List Number`, `List Number 2`), based on nesting level.
- Tables:
  - Render with `Table Grid` style; apply per-column alignment to cell paragraphs.
- Math:
  - Convert LaTeX to OMML via `latex2mathml` -> `mathml2omml` and inject into runs.
  - Inline math goes inside paragraph runs; block math uses its own paragraph.

## Testing Strategy
- Parser tests: inline styling, lists, tables, and math tokenization.
- DOCX tests: verify run flags, list styles, table structure, and presence of OMML in document XML.
- Keep existing heading/paragraph tests updated with expanded run schema.
