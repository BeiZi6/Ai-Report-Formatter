from __future__ import annotations

import re
from xml.sax.saxutils import escape

from latex2mathml.converter import convert as latex_to_mathml
from mathml2omml import convert as mathml_to_omml

MATHML_NS = "http://www.w3.org/1998/Math/MathML"
OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
ALIGNED_PATTERN = re.compile(
    r"\\begin\{(?P<env>aligned|align\*?)\}(?P<body>.*?)\\end\{(?P=env)\}",
    re.DOTALL,
)


def _extract_mathml_body(mathml: str) -> str:
    match = re.search(r"<math[^>]*>(.*)</math>", mathml, flags=re.DOTALL)
    return match.group(1) if match else mathml


def _column_align(count: int) -> str:
    if count <= 1:
        return "center"
    aligns = []
    for idx in range(count):
        aligns.append("right" if idx % 2 == 0 else "left")
    return " ".join(aligns)


def _latex_fragment_to_mathml(latex: str) -> str:
    if not latex:
        return "<mrow/>"
    try:
        return _extract_mathml_body(latex_to_mathml(latex))
    except Exception:
        return f"<mrow><mtext>{escape(latex)}</mtext></mrow>"


def _convert_aligned_to_mathml(latex: str) -> str | None:
    match = ALIGNED_PATTERN.fullmatch(latex.strip())
    if not match:
        return None
    body = match.group("body")
    rows = [row.strip() for row in re.split(r"\\\\", body) if row.strip()]
    if not rows:
        return None
    parsed_rows = []
    max_cols = 0
    for row in rows:
        cells = [cell.strip() for cell in row.split("&")]
        max_cols = max(max_cols, len(cells))
        parsed_rows.append(cells)

    row_xml = []
    for cells in parsed_rows:
        cell_xml = []
        for cell in cells:
            cell_xml.append(f"<mtd>{_latex_fragment_to_mathml(cell)}</mtd>")
        for _ in range(max_cols - len(cells)):
            cell_xml.append("<mtd/>")
        row_xml.append(f"<mtr>{''.join(cell_xml)}</mtr>")

    columnalign = _column_align(max_cols)
    return (
        f'<math xmlns="{MATHML_NS}" display="block">'
        f'<mtable columnalign="{columnalign}">{"".join(row_xml)}</mtable>'
        "</math>"
    )


def latex_to_omml(latex: str) -> str:
    aligned_mathml = _convert_aligned_to_mathml(latex)
    if aligned_mathml is not None:
        return _ensure_omml_namespace(mathml_to_omml(aligned_mathml))
    mathml = latex_to_mathml(latex)
    return _ensure_omml_namespace(mathml_to_omml(mathml))


def _ensure_omml_namespace(omml: str) -> str:
    if "xmlns:m=" in omml:
        return omml
    return omml.replace(
        "<m:oMath",
        f'<m:oMath xmlns:m="{OMML_NS}"',
        1,
    )
