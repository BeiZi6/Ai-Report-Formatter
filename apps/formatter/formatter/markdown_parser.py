from __future__ import annotations

from typing import Any

from markdown_it import MarkdownIt
from mdit_py_plugins.dollarmath.index import dollarmath_plugin
from mdit_py_plugins.footnote.index import footnote_plugin
from mdit_py_plugins.tasklists import tasklists_plugin

AstNode = dict[str, Any]
RunNode = dict[str, Any]

STYLE_KEYS = (
    "bold",
    "italic",
    "strike",
    "highlight",
    "superscript",
    "subscript",
    "code",
    "link",
)


def _default_style() -> dict[str, bool]:
    return {key: False for key in STYLE_KEYS}


def _style_key(style: dict[str, bool]) -> tuple[bool, ...]:
    return tuple(style.get(key, False) for key in STYLE_KEYS)


def _append_run(runs: list[RunNode], text: str, style: dict[str, bool], force_new: bool = False) -> None:
    if not text:
        return
    if not force_new and runs and runs[-1].get("type") != "math" and _style_key(runs[-1]) == _style_key(style):
        runs[-1]["text"] += text
    else:
        run: RunNode = {"text": text}
        run.update(style)
        runs.append(run)


def _plain_run(text: str) -> RunNode:
    run: RunNode = {"text": text}
    run.update(_default_style())
    return run


def _emit_text_with_markers(text: str, base_style: dict[str, bool], runs: list[RunNode]) -> None:
    idx = 0
    length = len(text)
    while idx < length:
        if text.startswith("==", idx):
            end = text.find("==", idx + 2)
            if end != -1:
                segment = text[idx + 2 : end]
                if segment:
                    style = base_style.copy()
                    style["highlight"] = True
                    _append_run(runs, segment, style)
                idx = end + 2
                continue
        if text.startswith("^", idx):
            end = text.find("^", idx + 1)
            if end != -1:
                segment = text[idx + 1 : end]
                if segment:
                    style = base_style.copy()
                    style["superscript"] = True
                    _append_run(runs, segment, style)
                idx = end + 1
                continue
        if text.startswith("~", idx):
            end = text.find("~", idx + 1)
            if end != -1:
                segment = text[idx + 1 : end]
                if segment:
                    style = base_style.copy()
                    style["subscript"] = True
                    _append_run(runs, segment, style)
                idx = end + 1
                continue
        next_starts_marker = False
        if idx + 1 < length:
            next_char = text[idx + 1]
            if next_char in {"^", "~"} or text.startswith("==", idx + 1):
                next_starts_marker = True
        _append_run(runs, text[idx], base_style, force_new=next_starts_marker)
        idx += 1


def _build_inline_runs(token) -> tuple[str, list[RunNode]]:
    runs: list[RunNode] = []
    style = _default_style()
    link_stack: list[str] = []

    for child in token.children or []:
        if child.type == "link_open":
            link_stack.append(child.attrGet("href") or "")
            continue
        if child.type == "link_close":
            href = link_stack.pop() if link_stack else ""
            if href:
                _append_run(runs, f" ({href})", style)
            continue
        if child.type == "strong_open":
            style["bold"] = True
            continue
        if child.type == "strong_close":
            style["bold"] = False
            continue
        if child.type == "em_open":
            style["italic"] = True
            continue
        if child.type == "em_close":
            style["italic"] = False
            continue
        if child.type in {"s_open", "strike_open"}:
            style["strike"] = True
            continue
        if child.type in {"s_close", "strike_close"}:
            style["strike"] = False
            continue
        if child.type in {"softbreak", "hardbreak"}:
            _append_run(runs, " ", style)
            continue
        if child.type == "code_inline":
            code_style = style.copy()
            code_style["code"] = True
            _append_run(runs, child.content, code_style)
            continue
        if child.type == "math_inline":
            runs.append({"type": "math", "latex": child.content})
            continue
        if child.type == "footnote_ref":
            label = str((child.meta or {}).get("label") or "").strip()
            if label:
                footnote_style = style.copy()
                footnote_style["superscript"] = True
                _append_run(runs, f"[{label}]", footnote_style, force_new=True)
            continue
        if child.type == "html_inline" and "task-list-item-checkbox" in (child.content or ""):
            continue

        text_style = style.copy()
        if link_stack:
            text_style["link"] = True

        if child.type == "text":
            _emit_text_with_markers(child.content, text_style, runs)
            continue
        if child.content:
            _emit_text_with_markers(child.content, text_style, runs)

    text = "".join(run.get("text", "") for run in runs if run.get("type") != "math").strip()
    return text, runs


def _flush_inline_paragraph(
    nodes: list[AstNode], runs: list[RunNode], task_checked: bool | None = None
) -> None:
    if not runs:
        return
    text = "".join(run.get("text", "") for run in runs if run.get("type") != "math").strip()
    paragraph: AstNode = {
        "type": "paragraph",
        "text": text,
        "runs": runs or [{"text": text, **_default_style()}],
    }
    if task_checked is not None:
        paragraph["task"] = True
        paragraph["checked"] = task_checked
    nodes.append(paragraph)


def _build_inline_nodes(token) -> list[AstNode]:
    nodes: list[AstNode] = []
    runs: list[RunNode] = []
    style = _default_style()
    task_checked: bool | None = None
    link_stack: list[str] = []

    for child in token.children or []:
        if child.type == "link_open":
            link_stack.append(child.attrGet("href") or "")
            continue
        if child.type == "link_close":
            href = link_stack.pop() if link_stack else ""
            if href:
                _append_run(runs, f" ({href})", style)
            continue
        if child.type == "strong_open":
            style["bold"] = True
            continue
        if child.type == "strong_close":
            style["bold"] = False
            continue
        if child.type == "em_open":
            style["italic"] = True
            continue
        if child.type == "em_close":
            style["italic"] = False
            continue
        if child.type in {"s_open", "strike_open"}:
            style["strike"] = True
            continue
        if child.type in {"s_close", "strike_close"}:
            style["strike"] = False
            continue
        if child.type in {"softbreak", "hardbreak"}:
            _append_run(runs, " ", style)
            continue
        if child.type == "code_inline":
            code_style = style.copy()
            code_style["code"] = True
            _append_run(runs, child.content, code_style)
            continue
        if child.type == "math_inline":
            runs.append({"type": "math", "latex": child.content})
            continue
        if child.type == "footnote_ref":
            label = str((child.meta or {}).get("label") or "").strip()
            if label:
                footnote_style = style.copy()
                footnote_style["superscript"] = True
                _append_run(runs, f"[{label}]", footnote_style, force_new=True)
            continue
        if child.type == "html_inline" and "task-list-item-checkbox" in (child.content or ""):
            task_checked = "checked" in (child.content or "")
            continue
        if child.type == "math_inline_double":
            _flush_inline_paragraph(nodes, runs, task_checked)
            runs = []
            task_checked = None
            nodes.append({"type": "math_block", "latex": child.content.strip()})
            continue

        text_style = style.copy()
        if link_stack:
            text_style["link"] = True

        if child.type == "text":
            _emit_text_with_markers(child.content, text_style, runs)
            continue
        if child.content:
            _emit_text_with_markers(child.content, text_style, runs)

    _flush_inline_paragraph(nodes, runs, task_checked)
    return nodes


def _parse_table(tokens, i: int) -> tuple[AstNode, int]:
    header: list[AstNode] = []
    rows: list[list[AstNode]] = []
    align: list[str] = []
    i += 1
    while i < len(tokens):
        token = tokens[i]
        if token.type == "table_close":
            i += 1
            break
        if token.type in {"thead_open", "tbody_open"}:
            i += 1
            continue
        if token.type in {"thead_close", "tbody_close"}:
            i += 1
            continue
        if token.type == "tr_open":
            i += 1
            cells: list[AstNode] = []
            while tokens[i].type != "tr_close":
                if tokens[i].type in {"th_open", "td_open"}:
                    cell_token = tokens[i]
                    style_attr = cell_token.attrGet("style") or ""
                    if "text-align" in style_attr:
                        if "center" in style_attr:
                            align.append("center")
                        elif "right" in style_attr:
                            align.append("right")
                        else:
                            align.append("left")
                    i += 1
                    inline = tokens[i]
                    text, runs = _build_inline_runs(inline)
                    cells.append({"text": text, "runs": runs})
                    i += 1
                else:
                    i += 1
            if not header:
                header = cells
            else:
                rows.append(cells)
            i += 1
            continue
        i += 1

    if not align:
        align = ["left"] * (len(header) if header else 0)
    else:
        align = align[: len(header)]
    return {"type": "table", "align": align, "header": header, "rows": rows}, i


def _parse_footnote_block(tokens, i: int) -> tuple[list[AstNode], int]:
    nodes: list[AstNode] = []
    footnotes: list[AstNode] = []
    i += 1

    while i < len(tokens):
        token = tokens[i]
        if token.type == "footnote_block_close":
            i += 1
            break

        if token.type != "footnote_open":
            i += 1
            continue

        meta = token.meta or {}
        label = str(meta.get("label") or "").strip()
        if not label:
            label = str(int(meta.get("id", len(footnotes))) + 1)

        i += 1
        entry_nodes, i = _parse_blocks(tokens, i, stop={"footnote_close"})
        if i < len(tokens) and tokens[i].type == "footnote_close":
            i += 1

        if not entry_nodes:
            footnotes.append(
                {
                    "type": "paragraph",
                    "text": f"[{label}]",
                    "runs": [_plain_run(f"[{label}]")],
                }
            )
            continue

        first = entry_nodes[0]
        if first.get("type") == "paragraph":
            prefix = f"[{label}] "
            first["text"] = f"{prefix}{first.get('text', '').strip()}".strip()
            first["runs"] = [_plain_run(prefix)] + first.get("runs", [])
        else:
            entry_nodes.insert(
                0,
                {
                    "type": "paragraph",
                    "text": f"[{label}]",
                    "runs": [_plain_run(f"[{label}]")],
                },
            )

        footnotes.extend(entry_nodes)

    if footnotes:
        nodes.append(
            {
                "type": "heading",
                "level": 1,
                "text": "脚注",
                "runs": [_plain_run("脚注")],
            }
        )
        nodes.extend(footnotes)

    return nodes, i


def _parse_blocks(
    tokens, i: int, stop: set[str] | None = None, list_level: int = 0
) -> tuple[list[AstNode], int]:
    ast: list[AstNode] = []
    while i < len(tokens):
        token = tokens[i]
        if stop and token.type in stop:
            break
        if token.type == "heading_open":
            level = max(1, min(4, int(token.tag[1]) - 1))
            text_token = tokens[i + 1]
            text, runs = _build_inline_runs(text_token)
            ast.append(
                {
                    "type": "heading",
                    "level": level,
                    "text": text,
                    "runs": runs or [{"text": text, **_default_style()}],
                }
            )
            i += 3
            continue
        if token.type == "blockquote_open":
            i += 1
            children, i = _parse_blocks(tokens, i, stop={"blockquote_close"}, list_level=list_level)
            ast.append({"type": "blockquote", "children": children})
            if i < len(tokens) and tokens[i].type == "blockquote_close":
                i += 1
            continue
        if token.type == "paragraph_open":
            text_token = tokens[i + 1]
            nodes = _build_inline_nodes(text_token)
            ast.extend(nodes)
            i += 3
            continue
        if token.type in {"bullet_list_open", "ordered_list_open"}:
            ordered = token.type == "ordered_list_open"
            start = int(token.attrGet("start") or 1)
            current_level = list_level + 1
            i += 1
            items: list[list[AstNode]] = []
            while i < len(tokens) and tokens[i].type not in {"bullet_list_close", "ordered_list_close"}:
                if tokens[i].type == "list_item_open":
                    i += 1
                    item_nodes, i = _parse_blocks(tokens, i, stop={"list_item_close"}, list_level=current_level)
                    items.append(item_nodes)
                    i += 1
                    continue
                i += 1
            i += 1
            ast.append(
                {
                    "type": "list",
                    "ordered": ordered,
                    "level": current_level,
                    "start": start,
                    "items": items,
                }
            )
            continue
        if token.type == "table_open":
            table_node, i = _parse_table(tokens, i)
            ast.append(table_node)
            continue
        if token.type == "footnote_block_open":
            footnote_nodes, i = _parse_footnote_block(tokens, i)
            ast.extend(footnote_nodes)
            continue
        if token.type == "math_block":
            ast.append({"type": "math_block", "latex": token.content.strip()})
            i += 1
            continue
        if token.type in {"fence", "code_block"}:
            ast.append(
                {
                    "type": "code_block",
                    "text": token.content.rstrip("\n"),
                    "info": (token.info or "").strip(),
                }
            )
            i += 1
            continue
        if token.type == "hr":
            i += 1
            continue
        i += 1
    return ast, i


def _normalize_math_blocks(text: str) -> str:
    lines = text.splitlines()
    normalized: list[str] = []
    in_block = False
    for idx, line in enumerate(lines):
        if line.strip() == "$$":
            if not in_block:
                if normalized and normalized[-1].strip():
                    normalized.append("")
                normalized.append(line)
                in_block = True
            else:
                normalized.append(line)
                in_block = False
                if idx + 1 < len(lines) and lines[idx + 1].strip():
                    normalized.append("")
            continue
        normalized.append(line)
    return "\n".join(normalized)


def _build_markdown_it() -> MarkdownIt:
    md = MarkdownIt("commonmark")
    md.enable("table").enable("strikethrough")
    md.use(dollarmath_plugin, double_inline=True)
    md.use(footnote_plugin)
    md.use(tasklists_plugin, enabled=True)
    return md


def render_preview_html(text: str) -> str:
    text = _normalize_math_blocks(text)
    md = _build_markdown_it()
    return md.render(text)


def parse_markdown(text: str) -> list[AstNode]:
    text = _normalize_math_blocks(text)
    md = _build_markdown_it()
    tokens = md.parse(text)
    ast, _ = _parse_blocks(tokens, 0)
    return ast
