# AI Report Formatter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Streamlit app that converts Markdown to a formatted Word report with citation normalization and LaTeX-to-Word formulas.

**Architecture:** Pure-Python pipeline: Markdown -> AST -> citations/LaTeX transforms -> docx builder. Streamlit UI controls style config and triggers export. Structural summary preview only.

**Tech Stack:** Python, Streamlit, python-docx, markdown-it-py, latex2mathml, mathml2omml (or equivalent), pytest.

---

### Task 1: Citation Normalizer (baseline test + core utility)

**Files:**
- Create: `apps/formatter/formatter/__init__.py`
- Create: `apps/formatter/formatter/citations.py`
- Create: `tests/formatter/test_citations.py`

**Step 1: Write the failing test**

```python
from formatter.citations import normalize_citations


def test_normalize_citations_extracts_ordered_refs():
    text = "This is a claim [2] and another [1]."
    normalized, refs = normalize_citations(text)
    assert normalized == "This is a claim [2] and another [1]."
    assert refs == ["[2]", "[1]"]
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/formatter/test_citations.py::test_normalize_citations_extracts_ordered_refs -v`
Expected: FAIL (likely ImportError first; fix import by adding minimal module in next step, then re-run to see assertion failure).

**Step 3: Write minimal implementation**

```python
import re

_CITATION_RE = re.compile(r"\[(\d+)\]")


def normalize_citations(text: str):
    refs = [f"[{m.group(1)}]" for m in _CITATION_RE.finditer(text)]
    return text, refs
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/formatter/test_citations.py::test_normalize_citations_extracts_ordered_refs -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/formatter/formatter/__init__.py apps/formatter/formatter/citations.py tests/formatter/test_citations.py
git commit -m "feat: add citation normalizer"
```

---

### Task 2: Markdown AST Parser (basic block support)

**Files:**
- Create: `apps/formatter/formatter/markdown_parser.py`
- Create: `tests/formatter/test_markdown_parser.py`

**Step 1: Write the failing test**

```python
from formatter.markdown_parser import parse_markdown


def test_parse_markdown_headings_and_paragraphs():
    ast = parse_markdown("# Title\n\nHello")
    assert ast == [
        {"type": "heading", "level": 1, "text": "Title"},
        {"type": "paragraph", "text": "Hello"},
    ]
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/formatter/test_markdown_parser.py::test_parse_markdown_headings_and_paragraphs -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```python
from markdown_it import MarkdownIt


def parse_markdown(text: str):
    md = MarkdownIt()
    tokens = md.parse(text)
    ast = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t.type == "heading_open":
            level = int(t.tag[1])
            text_token = tokens[i + 1]
            ast.append({"type": "heading", "level": level, "text": text_token.content})
            i += 3
            continue
        if t.type == "paragraph_open":
            text_token = tokens[i + 1]
            ast.append({"type": "paragraph", "text": text_token.content})
            i += 3
            continue
        i += 1
    return ast
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/formatter/test_markdown_parser.py::test_parse_markdown_headings_and_paragraphs -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/formatter/formatter/markdown_parser.py tests/formatter/test_markdown_parser.py
git commit -m "feat: parse basic markdown blocks"
```

---

### Task 3: Config Model + Preview Summary

**Files:**
- Create: `apps/formatter/formatter/config.py`
- Create: `apps/formatter/formatter/preview.py`
- Create: `tests/formatter/test_preview.py`

**Step 1: Write the failing test**

```python
from formatter.preview import summarize_ast


def test_summarize_ast_counts_blocks():
    ast = [
        {"type": "heading", "level": 1, "text": "Title"},
        {"type": "paragraph", "text": "Hello"},
    ]
    summary = summarize_ast(ast)
    assert summary["headings"] == 1
    assert summary["paragraphs"] == 1
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/formatter/test_preview.py::test_summarize_ast_counts_blocks -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```python
from dataclasses import dataclass


@dataclass
class FormatConfig:
    cn_font: str = "SimSun"
    en_font: str = "Times New Roman"
    heading_size_pt: int = 16
    body_size_pt: int = 12
    line_spacing: float = 1.5
    para_before_pt: int = 0
    para_after_pt: int = 0
    first_line_indent: bool = True
    clear_background: bool = True
    page_num_position: str = "center"


def summarize_ast(ast):
    counts = {"headings": 0, "paragraphs": 0}
    for node in ast:
        if node.get("type") == "heading":
            counts["headings"] += 1
        if node.get("type") == "paragraph":
            counts["paragraphs"] += 1
    return counts
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/formatter/test_preview.py::test_summarize_ast_counts_blocks -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/formatter/formatter/config.py apps/formatter/formatter/preview.py tests/formatter/test_preview.py
git commit -m "feat: add config model and preview summary"
```

---

### Task 4: Docx Builder (headings + paragraphs)

**Files:**
- Create: `apps/formatter/formatter/docx_builder.py`
- Create: `tests/formatter/test_docx_builder.py`

**Step 1: Write the failing test**

```python
from formatter.docx_builder import build_docx


def test_build_docx_creates_docx(tmp_path):
    ast = [
        {"type": "heading", "level": 1, "text": "Title"},
        {"type": "paragraph", "text": "Hello"},
    ]
    output = tmp_path / "out.docx"
    build_docx(ast, output)
    assert output.exists()
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/formatter/test_docx_builder.py::test_build_docx_creates_docx -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```python
from docx import Document


def build_docx(ast, output_path):
    doc = Document()
    for node in ast:
        if node.get("type") == "heading":
            doc.add_heading(node.get("text", ""), level=node.get("level", 1))
        elif node.get("type") == "paragraph":
            doc.add_paragraph(node.get("text", ""))
    doc.save(output_path)
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/formatter/test_docx_builder.py::test_build_docx_creates_docx -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/formatter/formatter/docx_builder.py tests/formatter/test_docx_builder.py
git commit -m "feat: build basic docx output"
```

---

### Task 5: LaTeX to OMML Converter (success + fallback)

**Files:**
- Create: `apps/formatter/formatter/latex.py`
- Create: `tests/formatter/test_latex.py`

**Step 1: Write the failing test**

```python
from formatter.latex import latex_to_omml


def test_latex_to_omml_returns_xml_string():
    omml = latex_to_omml("x^2")
    assert omml.strip().startswith("<m:oMath")
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/formatter/test_latex.py::test_latex_to_omml_returns_xml_string -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```python
from latex2mathml.converter import convert as latex_to_mathml
from mathml2omml import convert as mathml_to_omml


def latex_to_omml(latex: str) -> str:
    mathml = latex_to_mathml(latex)
    return mathml_to_omml(mathml)
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/formatter/test_latex.py::test_latex_to_omml_returns_xml_string -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/formatter/formatter/latex.py tests/formatter/test_latex.py
git commit -m "feat: convert latex to omml"
```

---

### Task 6: Streamlit UI (input + config + preview + export)

**Files:**
- Create: `apps/formatter/app.py`
- Create: `apps/formatter/formatter/pipeline.py`
- Create: `tests/formatter/test_pipeline.py`

**Step 1: Write the failing test**

```python
from formatter.pipeline import format_markdown


def test_pipeline_returns_ast_and_refs():
    result = format_markdown("# Title\n\nHello [1].")
    assert result["refs"] == ["[1]"]
    assert result["ast"][0]["type"] == "heading"
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/formatter/test_pipeline.py::test_pipeline_returns_ast_and_refs -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```python
from formatter.markdown_parser import parse_markdown
from formatter.citations import normalize_citations


def format_markdown(text: str):
    normalized, refs = normalize_citations(text)
    ast = parse_markdown(normalized)
    return {"ast": ast, "refs": refs}
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/formatter/test_pipeline.py::test_pipeline_returns_ast_and_refs -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/formatter/formatter/pipeline.py tests/formatter/test_pipeline.py
git commit -m "feat: add formatting pipeline"
```

---

### Task 7: Requirements + README for Formatter App

**Files:**
- Create: `apps/formatter/requirements.txt`
- Create: `apps/formatter/README.md`

**Step 1: Add requirements file**

```
streamlit
python-docx
markdown-it-py
latex2mathml
mathml2omml
```

**Step 2: Add formatter README**

Include run instructions:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r apps/formatter/requirements.txt
streamlit run apps/formatter/app.py
```

**Step 3: Commit**

```bash
git add apps/formatter/requirements.txt apps/formatter/README.md
git commit -m "docs: add formatter app setup"
```

---

### Task 8: Final Test Run

**Step 1: Run tests**

Run: `pytest -v`
Expected: PASS

**Step 2: Commit (if needed)**

```bash
git add -A
git commit -m "test: green test suite"
```
