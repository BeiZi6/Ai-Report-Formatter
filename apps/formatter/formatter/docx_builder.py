from __future__ import annotations

from docx import Document
from docx.enum.text import WD_COLOR_INDEX, WD_PARAGRAPH_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

from formatter.config import FormatConfig
from formatter.latex import latex_to_omml


def _set_style_fonts(style, ascii_font: str, east_asia_font: str | None = None) -> None:
    style.font.name = ascii_font
    rfonts = style.element.rPr.rFonts
    rfonts.set(qn("w:ascii"), ascii_font)
    rfonts.set(qn("w:hAnsi"), ascii_font)
    if east_asia_font:
        rfonts.set(qn("w:eastAsia"), east_asia_font)


def _lines_to_pt(lines: float, font_size_pt: int) -> Pt:
    return Pt(lines * font_size_pt)


def _chars_to_pt(chars: int, font_size_pt: int) -> Pt:
    return Pt(chars * font_size_pt)


LIST_INDENT_PT = 18


def _apply_list_indents(paragraph, level: int) -> None:
    paragraph.paragraph_format.left_indent = Pt(LIST_INDENT_PT * level)
    paragraph.paragraph_format.first_line_indent = Pt(-LIST_INDENT_PT / 2)


def _apply_style_paragraph(style, size_pt, line_spacing, before_lines, after_lines, align=None) -> None:
    style.font.size = Pt(size_pt)
    pf = style.paragraph_format
    pf.space_before = _lines_to_pt(before_lines, size_pt)
    pf.space_after = _lines_to_pt(after_lines, size_pt)
    pf.line_spacing = line_spacing
    if align is not None:
        pf.alignment = align


def _add_page_number(section, position: str) -> None:
    footer = section.footer
    paragraph = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
    if position == "right":
        paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.RIGHT
    run = paragraph.add_run()
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    run._r.append(fld)


def _add_math_run(paragraph, latex: str) -> None:
    run = paragraph.add_run()
    try:
        omml = latex_to_omml(latex)
        omml = _ensure_omml_namespace(omml)
        run._r.append(parse_xml(omml))
    except Exception:
        run.text = latex


def _add_equation_number(paragraph) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    tabs = OxmlElement("w:tabs")
    tab = OxmlElement("w:tab")
    tab.set(qn("w:val"), "right")
    tab.set(qn("w:pos"), "9350")
    tabs.append(tab)
    p_pr.append(tabs)

    paragraph.add_run("\t(")
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "SEQ Equation")
    paragraph._p.append(fld)
    paragraph.add_run(")")


def _apply_run_styles(docx_run, run: dict) -> None:
    docx_run.bold = bool(run.get("bold"))
    docx_run.italic = bool(run.get("italic"))
    if run.get("strike"):
        docx_run.font.strike = True
    if run.get("highlight"):
        docx_run.font.highlight_color = WD_COLOR_INDEX.YELLOW
    if run.get("superscript"):
        docx_run.font.superscript = True
    if run.get("subscript"):
        docx_run.font.subscript = True
    if run.get("code"):
        docx_run.font.name = "Consolas"


def _ensure_omml_namespace(omml: str) -> str:
    if "xmlns:m=" in omml:
        return omml
    if "<m:oMathPara" in omml:
        return omml.replace(
            "<m:oMathPara",
            '<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
            1,
        )
    return omml.replace(
        "<m:oMath",
        '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
        1,
    )


def _add_runs(paragraph, runs: list[dict], fallback_text: str = "") -> None:
    if not runs:
        if fallback_text:
            paragraph.add_run(fallback_text)
        return
    for run in runs:
        if run.get("type") == "math":
            _add_math_run(paragraph, run.get("latex", ""))
            continue
        text = run.get("text", "")
        if not text:
            continue
        docx_run = paragraph.add_run(text)
        _apply_run_styles(docx_run, run)


def _list_style_name(ordered: bool, level: int) -> str:
    base = "List Number" if ordered else "List Bullet"
    if level <= 1:
        return base
    level_suffix = min(level, 3)
    return f"{base} {level_suffix}"


def _add_list(doc, node: dict, config: FormatConfig) -> None:
    for item in node.get("items", []):
        for child in item:
            if child.get("type") == "paragraph":
                style_name = _list_style_name(node.get("ordered", False), node.get("level", 1))
                paragraph = doc.add_paragraph("", style=style_name)
                _add_runs(paragraph, child.get("runs", []), child.get("text", ""))
                _apply_list_indents(paragraph, node.get("level", 1))
            elif child.get("type") == "list":
                _add_list(doc, child, config)
            elif child.get("type") == "math_block":
                paragraph = doc.add_paragraph("", style=_list_style_name(node.get("ordered", False), node.get("level", 1)))
                _add_math_run(paragraph, child.get("latex", ""))
                _apply_list_indents(paragraph, node.get("level", 1))
            elif child.get("type") == "table":
                _add_table(doc, child)


def _cell_alignment(align: str):
    if align == "center":
        return WD_PARAGRAPH_ALIGNMENT.CENTER
    if align == "right":
        return WD_PARAGRAPH_ALIGNMENT.RIGHT
    return WD_PARAGRAPH_ALIGNMENT.LEFT


def _add_table(doc, node: dict) -> None:
    header = node.get("header", [])
    rows = node.get("rows", [])
    if not header:
        return
    align = node.get("align", ["left"] * len(header))
    table = doc.add_table(rows=1 + len(rows), cols=len(header))
    table.style = "Table Grid"

    all_rows = [header] + rows
    for r_idx, row in enumerate(all_rows):
        for c_idx, cell in enumerate(row):
            cell_obj = table.cell(r_idx, c_idx)
            cell_obj.text = ""
            paragraph = cell_obj.paragraphs[0]
            paragraph.alignment = _cell_alignment(align[c_idx] if c_idx < len(align) else "left")
            _add_runs(paragraph, cell.get("runs", []), cell.get("text", ""))


def build_docx(ast: list[dict], output_path, config: FormatConfig | None = None) -> None:
    config = config or FormatConfig()
    doc = Document()

    section = doc.sections[0]
    section.top_margin = Cm(2.54)
    section.bottom_margin = Cm(2.54)
    section.left_margin = Cm(3.18)
    section.right_margin = Cm(3.18)

    try:
        _add_page_number(section, config.page_num_position)
    except Exception:
        pass

    try:
        normal = doc.styles["Normal"]
        _set_style_fonts(normal, config.body_style.en_font, config.body_style.cn_font)
        _apply_style_paragraph(
            normal,
            config.body_style.size_pt,
            config.body_style.line_spacing,
            config.body_style.para_before_lines,
            config.body_style.para_after_lines,
            WD_PARAGRAPH_ALIGNMENT.JUSTIFY if config.body_style.justify else None,
        )
        normal.paragraph_format.left_indent = _chars_to_pt(
            config.body_style.indent_before_chars, config.body_style.size_pt
        )
        normal.paragraph_format.right_indent = _chars_to_pt(
            config.body_style.indent_after_chars, config.body_style.size_pt
        )
        normal.paragraph_format.first_line_indent = _chars_to_pt(
            config.body_style.first_line_indent_chars, config.body_style.size_pt
        )

        for level, hstyle in config.heading_styles.items():
            h = doc.styles[f"Heading {level}"]
            _set_style_fonts(h, hstyle.font, hstyle.font)
            h.font.color.rgb = RGBColor(0, 0, 0)
            _apply_style_paragraph(
                h,
                hstyle.size_pt,
                hstyle.line_spacing,
                hstyle.para_before_lines,
                hstyle.para_after_lines,
            )
    except Exception:
        pass

    for node in ast:
        if node.get("type") == "heading":
            paragraph = doc.add_heading("", level=node.get("level", 1))
            _add_runs(paragraph, node.get("runs", []), node.get("text", ""))
        elif node.get("type") == "paragraph":
            paragraph = doc.add_paragraph("")
            _add_runs(paragraph, node.get("runs", []), node.get("text", ""))
            if config.body_style.justify:
                paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.JUSTIFY
            paragraph.paragraph_format.left_indent = _chars_to_pt(
                config.body_style.indent_before_chars, config.body_style.size_pt
            )
            paragraph.paragraph_format.right_indent = _chars_to_pt(
                config.body_style.indent_after_chars, config.body_style.size_pt
            )
            paragraph.paragraph_format.first_line_indent = _chars_to_pt(
                config.body_style.first_line_indent_chars, config.body_style.size_pt
            )
        elif node.get("type") == "list":
            _add_list(doc, node, config)
        elif node.get("type") == "table":
            _add_table(doc, node)
        elif node.get("type") == "math_block":
            paragraph = doc.add_paragraph("")
            _add_math_run(paragraph, node.get("latex", ""))
            _add_equation_number(paragraph)

    doc.save(output_path)
