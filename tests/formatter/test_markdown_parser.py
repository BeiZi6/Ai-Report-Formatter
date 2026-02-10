from formatter.markdown_parser import parse_markdown


def run(text, **overrides):
    base = {
        "text": text,
        "bold": False,
        "italic": False,
        "strike": False,
        "highlight": False,
        "superscript": False,
        "subscript": False,
        "code": False,
        "link": False,
    }
    base.update(overrides)
    return base


def math_run(latex):
    return {"type": "math", "latex": latex}


def test_parse_markdown_headings_and_paragraphs():
    ast = parse_markdown("# Title\n\nHello")
    assert ast == [
        {
            "type": "heading",
            "level": 1,
            "text": "Title",
            "runs": [run("Title")],
        },
        {
            "type": "paragraph",
            "text": "Hello",
            "runs": [run("Hello")],
        },
    ]


def test_parse_markdown_strips_bold_and_softbreaks():
    ast = parse_markdown("先说**结论**\n下一句")
    paragraph = ast[0]
    assert paragraph["text"] == "先说结论 下一句"
    assert paragraph["runs"] == [
        run("先说"),
        run("结论", bold=True),
        run(" 下一句"),
    ]


def test_parse_markdown_handles_nested_bold_markers():
    ast = parse_markdown("****加粗****")
    paragraph = ast[0]
    assert paragraph["text"] == "加粗"
    assert paragraph["runs"] == [run("加粗", bold=True)]


def test_parse_markdown_shifts_heading_levels():
    ast = parse_markdown("## 二级标题\n\n### 三级标题\n\n#### 四级标题\n\n##### 五级标题")
    assert ast[0]["type"] == "heading"
    assert ast[0]["level"] == 1
    assert ast[1]["type"] == "heading"
    assert ast[1]["level"] == 2
    assert ast[2]["type"] == "heading"
    assert ast[2]["level"] == 3
    assert ast[3]["type"] == "heading"
    assert ast[3]["level"] == 4


def test_parse_markdown_inline_styles():
    ast = parse_markdown("A *i* **b** ***bi*** ~~s~~ ==h== X^2^ H~2~O `code`")
    paragraph = ast[0]
    assert paragraph["runs"] == [
        run("A "),
        run("i", italic=True),
        run(" "),
        run("b", bold=True),
        run(" "),
        run("bi", bold=True, italic=True),
        run(" "),
        run("s", strike=True),
        run(" "),
        run("h", highlight=True),
        run(" "),
        run("X"),
        run("2", superscript=True),
        run(" "),
        run("H"),
        run("2", subscript=True),
        run("O "),
        run("code", code=True),
    ]


def test_parse_markdown_math_inline():
    ast = parse_markdown("勾股定理：$a^2 + b^2 = c^2$")
    paragraph = ast[0]
    assert paragraph["runs"][-1] == math_run("a^2 + b^2 = c^2")


def test_parse_markdown_math_block():
    ast = parse_markdown("$$ x $$")
    assert ast == [{"type": "math_block", "latex": "x"}]


def test_parse_markdown_math_block_after_text_line():
    ast = parse_markdown("块级公式:\n$$\n\\int_a^b f(x)\\,dx\n$$")
    assert ast == [
        {
            "type": "paragraph",
            "text": "块级公式:",
            "runs": [run("块级公式:")],
        },
        {"type": "math_block", "latex": "\\int_a^b f(x)\\,dx"},
    ]


def test_parse_markdown_math_block_inline_double_dollars():
    ast = parse_markdown("块级公式: $$\\int_a^b f(x)\\,dx$$")
    assert ast == [
        {
            "type": "paragraph",
            "text": "块级公式:",
            "runs": [run("块级公式: ")],
        },
        {"type": "math_block", "latex": "\\int_a^b f(x)\\,dx"},
    ]


def test_parse_markdown_lists():
    ast = parse_markdown("- 第一项\n  - 嵌套子项\n- 第二项")
    assert ast[0]["type"] == "list"
    assert ast[0]["ordered"] is False
    assert ast[0]["level"] == 1
    assert ast[0]["items"][0][0]["type"] == "paragraph"
    assert ast[0]["items"][0][1]["type"] == "list"
    assert ast[0]["items"][0][1]["level"] == 2


def test_parse_markdown_table_alignment():
    ast = parse_markdown("| 列1 | 列2 |\n|:-----|-----:|\n| A | B |")
    table = ast[0]
    assert table["type"] == "table"
    assert table["align"] == ["left", "right"]
    assert table["header"][0]["text"] == "列1"
    assert table["rows"][0][1]["text"] == "B"


def test_parse_markdown_task_lists_capture_checkbox_state():
    ast = parse_markdown("- [x] done\n- [ ] todo")
    list_node = ast[0]
    first = list_node["items"][0][0]
    second = list_node["items"][1][0]

    assert first["task"] is True
    assert first["checked"] is True
    assert first["text"] == "done"

    assert second["task"] is True
    assert second["checked"] is False
    assert second["text"] == "todo"


def test_parse_markdown_links_append_target_url():
    ast = parse_markdown("Read [Docs](https://example.com) now")
    paragraph = ast[0]

    assert paragraph["text"] == "Read Docs (https://example.com) now"


def test_parse_markdown_blockquote_is_preserved():
    ast = parse_markdown("> quoted line")
    assert ast == [
        {
            "type": "blockquote",
            "children": [
                {
                    "type": "paragraph",
                    "text": "quoted line",
                    "runs": [run("quoted line")],
                }
            ],
        }
    ]


def test_parse_markdown_footnotes_append_footnote_section():
    ast = parse_markdown("正文[^1]\n\n[^1]: 脚注内容")

    assert ast[0]["type"] == "paragraph"
    assert ast[0]["text"] == "正文[1]"
    assert ast[-2] == {
        "type": "heading",
        "level": 1,
        "text": "脚注",
        "runs": [run("脚注")],
    }
    assert ast[-1]["type"] == "paragraph"
    assert ast[-1]["text"] == "[1] 脚注内容"
