# Docx Styles Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure docx style configuration is robust (heading overrides, body paragraph formatting, fallback behavior) and covered by tests.

**Architecture:** Keep `FormatConfig` as the source of style defaults and override merging. `docx_builder.build_docx` continues to apply styles and paragraph-level formatting, with tests verifying margins, fonts, alignment, indent, and graceful failure behavior.

**Tech Stack:** Python, python-docx, pytest.

---

### Task 1: Support Heading Style Overrides While Filling Defaults

**Files:**
- Modify: `apps/formatter/formatter/config.py`
- Modify: `tests/formatter/test_config.py`

**Step 1: Write the failing test**

```python
from formatter.config import FormatConfig, HeadingStyle


def test_heading_styles_can_be_overridden_and_filled():
    config = FormatConfig(
        heading_styles={
            1: HeadingStyle(font="Arial", size_pt=20, line_spacing=1.0, para_before_pt=0, para_after_pt=0)
        }
    )
    assert set(config.heading_styles.keys()) == {1, 2, 3, 4}
    assert config.heading_styles[1].font == "Arial"
    assert config.heading_styles[2].font  # defaults filled for missing levels
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/formatter/test_config.py::test_heading_styles_can_be_overridden_and_filled -v`
Expected: FAIL (missing levels not filled)

**Step 3: Write minimal implementation**

```python
from dataclasses import dataclass, field


def _default_heading_styles(base: BodyStyle) -> dict[int, HeadingStyle]:
    return {
        1: HeadingStyle(font=base.cn_font, size_pt=16, line_spacing=base.line_spacing, para_before_pt=6, para_after_pt=6),
        2: HeadingStyle(font=base.cn_font, size_pt=14, line_spacing=base.line_spacing, para_before_pt=6, para_after_pt=6),
        3: HeadingStyle(font=base.cn_font, size_pt=13, line_spacing=base.line_spacing, para_before_pt=6, para_after_pt=6),
        4: HeadingStyle(font=base.cn_font, size_pt=12, line_spacing=base.line_spacing, para_before_pt=6, para_after_pt=6),
    }


@dataclass
class FormatConfig:
    ...

    def __post_init__(self) -> None:
        defaults = _default_heading_styles(self.body_style)
        if not self.heading_styles:
            self.heading_styles = defaults
            return
        for level, style in defaults.items():
            self.heading_styles.setdefault(level, style)
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/formatter/test_config.py::test_heading_styles_can_be_overridden_and_filled -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/formatter/formatter/config.py tests/formatter/test_config.py
git commit -m "feat: fill missing heading styles on overrides"
```

---

### Task 2: Verify Body Paragraph Alignment + Indent

**Files:**
- Modify: `tests/formatter/test_docx_styles.py`

**Step 1: Write the failing test**

```python
from docx import Document
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.shared import Pt

from formatter.config import FormatConfig
from formatter.docx_builder import build_docx


def test_body_paragraph_indent_and_alignment(tmp_path):
    config = FormatConfig()
    output = tmp_path / "out.docx"
    build_docx([{"type": "paragraph", "text": "Hello"}], output, config)

    doc = Document(output)
    paragraph = doc.paragraphs[0]
    assert paragraph.alignment == WD_PARAGRAPH_ALIGNMENT.JUSTIFY
    assert paragraph.paragraph_format.first_line_indent == Pt(config.body_style.size_pt * 2)
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/formatter/test_docx_styles.py::test_body_paragraph_indent_and_alignment -v`
Expected: FAIL (missing paragraph formatting)

**Step 3: Write minimal implementation**

If needed, ensure `build_docx` sets paragraph alignment and first-line indent for body paragraphs after inserting text.

**Step 4: Run test to verify it passes**

Run: `pytest tests/formatter/test_docx_styles.py::test_body_paragraph_indent_and_alignment -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/formatter/test_docx_styles.py apps/formatter/formatter/docx_builder.py
git commit -m "test: verify paragraph indent and alignment"
```

---

### Task 3: Fallback When Style Application Fails

**Files:**
- Modify: `tests/formatter/test_docx_styles.py`

**Step 1: Write the failing test**

```python
from docx import Document
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.shared import Pt

from formatter.config import FormatConfig
from formatter.docx_builder import build_docx


def test_build_docx_falls_back_on_style_failure(tmp_path, monkeypatch):
    def _boom(*args, **kwargs):
        raise RuntimeError("style write failed")

    monkeypatch.setattr("formatter.docx_builder._apply_style_paragraph", _boom)

    output = tmp_path / "out.docx"
    config = FormatConfig()
    build_docx([{"type": "paragraph", "text": "Hello"}], output, config)

    doc = Document(output)
    paragraph = doc.paragraphs[0]
    assert paragraph.alignment == WD_PARAGRAPH_ALIGNMENT.JUSTIFY
    assert paragraph.paragraph_format.first_line_indent == Pt(config.body_style.size_pt * 2)
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/formatter/test_docx_styles.py::test_build_docx_falls_back_on_style_failure -v`
Expected: FAIL (build fails or paragraph formatting not applied)

**Step 3: Write minimal implementation**

If failing, ensure `build_docx` always applies paragraph-level formatting for body paragraphs even when style writes fail.

**Step 4: Run test to verify it passes**

Run: `pytest tests/formatter/test_docx_styles.py::test_build_docx_falls_back_on_style_failure -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/formatter/test_docx_styles.py apps/formatter/formatter/docx_builder.py
git commit -m "test: ensure docx fallback on style failure"
```

---

### Task 4: Final Test Run

**Step 1: Run tests**

Run: `pytest -v`
Expected: PASS

**Step 2: Commit (if needed)**

```bash
git add -A
git commit -m "test: green test suite"
```
