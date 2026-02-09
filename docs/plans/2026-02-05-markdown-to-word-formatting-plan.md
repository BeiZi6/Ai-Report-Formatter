# Markdown→Word Table & Math Blocks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Center all table cell content in exported Word docs and improve block math rendering with automatic (1) style numbering, wiring the behavior through API + Web UI so users see the changes without manual steps.

**Architecture:** Keep the existing Markdown → AST → docx builder pipeline. Adjust docx rendering helpers so tables default to centered paragraphs and math blocks share a single rendering path that adds numbering and right-side positioning without relying on Word field updates. Ensure the FastAPI layer returns the updated docx and update the Next.js UI copy to reflect automatic numbering (remove “F9 to refresh” guidance). Update tests (formatter, API, web) to pin the new behavior.

**Tech Stack:** Python, python-docx, markdown-it-py with dollarmath, latex2mathml, mathml2omml, pytest.

---

### Task 1: Enforce centered table cells in docx output

**Files:**
- Modify: `apps/formatter/formatter/docx_builder.py`
- Modify: `tests/formatter/test_docx_builder.py`

**Step 1: Write failing test for centered table cells**
```python
def test_table_cells_are_center_aligned(tmp_path):
    ast = {
        "type": "table",
        "align": ["left", "right"],  # should be ignored for centering
        "header": [{"text": "H1"}, {"text": "H2"}],
        "rows": [[{"text": "A"}, {"text": "B"}]],
    }
    output = tmp_path / "out.docx"
    build_docx([ast], output, FormatConfig())
    doc = Document(output)
    for row in doc.tables[0].rows:
        for cell in row.cells:
            assert cell.paragraphs[0].alignment == WD_ALIGN_PARAGRAPH.CENTER
```

**Step 2: Run the single test to confirm it fails**
Run: `pytest tests/formatter/test_docx_builder.py::test_table_cells_are_center_aligned -q`
Expected: Fails because current alignment follows parsed align list.

**Step 3: Implement centered table rendering**
- In `_add_table`, force `paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER` for all cells, ignoring parsed align metadata.
- Keep existing three-line borders and run rendering intact.

**Step 4: Re-run the test**
Run: `pytest tests/formatter/test_docx_builder.py::test_table_cells_are_center_aligned -q`
Expected: Passes.


### Task 2: Improve block math rendering and numbering

**Files:**
- Modify: `apps/formatter/formatter/docx_builder.py`
- Modify: `apps/formatter/formatter/markdown_parser.py` (only if new metadata needed; otherwise untouched)
- Modify: `tests/formatter/test_docx_builder.py`

**Step 1: Add failing tests for numbered math blocks**
```python
def test_math_blocks_number_increment(tmp_path):
    ast = [
        {"type": "math_block", "latex": "x"},
        {"type": "math_block", "latex": "y"},
    ]
    output = tmp_path / "out.docx"
    build_docx(ast, output, FormatConfig())
    doc = Document(output)
    texts = [p.text.strip() for p in doc.paragraphs]
    assert "(1)" in texts[0]
    assert "(2)" in texts[1]


def test_math_block_in_list_keeps_numbering(tmp_path):
    ast = [{
        "type": "list",
        "ordered": False,
        "level": 1,
        "start": 1,
        "items": [[{"type": "math_block", "latex": "a"}]]
    }]
    output = tmp_path / "out.docx"
    build_docx(ast, output, FormatConfig())
    doc = Document(output)
    para_xml = doc.paragraphs[0]._p.xml
    assert "(1)" in doc.paragraphs[0].text
    assert "oMath" in para_xml
```

**Step 2: Run the new tests to see failures**
Run: `pytest tests/formatter/test_docx_builder.py::test_math_blocks_number_increment -q`
Run: `pytest tests/formatter/test_docx_builder.py::test_math_block_in_list_keeps_numbering -q`
Expected: Fails because numbering currently uses Word fields and list math blocks lack numbering.

**Step 3: Implement deterministic numbering and shared math rendering**
- Track an `equation_index` counter in `build_docx`; pass it through to math-block rendering.
- Refactor math block rendering into a helper that both top-level and list math blocks call.
- Replace Word field-based numbering with explicit right-aligned `(n)` text appended via a tab stop, so numbers appear without manual field updates.
- Ensure paragraphs remain center aligned for math content.

**Step 4: Re-run tests**
Run: `pytest tests/formatter/test_docx_builder.py::test_math_blocks_number_increment tests/formatter/test_docx_builder.py::test_math_block_in_list_keeps_numbering -q`
Expected: Passes.


### Task 3: FastAPI surface verification

**Files:**
- Modify: `apps/api/main.py` (only if new config fields surface; otherwise reuse existing payload handling)
- Modify: `apps/api/tests/test_api.py`

**Step 1: Add failing API test for numbered math block output**
```python
def test_generate_returns_numbered_math_block(tmp_path):
    payload = {"markdown": "$$ x $$", "config": {}}
    resp = client.post("/api/generate", json=payload)
    assert resp.status_code == 200
    doc_path = tmp_path / "out.docx"
    doc_path.write_bytes(resp.content)
    doc = Document(doc_path)
    para = doc.paragraphs[0]
    assert "(1)" in para.text
    assert "oMath" in para._p.xml
```

**Step 2: Run the new API test**
Run: `pytest apps/api/tests/test_api.py::test_generate_returns_numbered_math_block -q`
Expected: Fails until formatter changes ship through API.

**Step 3: Adjust API if needed**
- If formatter changes require config tweaks, map any new fields in `build_format_config`; otherwise no code change.

**Step 4: Re-run API tests**
Run: `pytest apps/api/tests/test_api.py -q`
Expected: Pass.


### Task 4: Web UI copy and expectations

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/tests/app.spec.ts` (if copy changes need assertions)

**Step 1: Update UI copy**
- In the “导出提示” note, replace the F9/手动刷新提示 with text that states tables are centered and块级公式自动按 (1) 编号，无需手动刷新。

**Step 2: Add/update Playwright check (optional but preferred)**
- Assert the note text includes “自动编号” or similar string to lock the new guidance.

**Step 3: Run web E2E smoke**
Run: `npm run test` (or `npx playwright test`) from `apps/web`.
Expected: Pass.


### Task 5: Regression sweep

**Files:**
- Tests only.

**Step 1: Run formatter test suite**
Run: `pytest tests/formatter -q`
Expected: All formatter tests pass.

**Step 2: Optional targeted docx sanity check**
- Generate a sample doc via `streamlit run apps/formatter/app.py` and export manually if time permits.

**Step 3: Prepare for commit (if requested)**
- `git status` to confirm changed files.
