from __future__ import annotations

import tempfile

import streamlit as st

from formatter.app_logic import build_preview_payload
from formatter.config import FormatConfig
from formatter.docx_builder import build_docx


def _apply_theme() -> None:
    st.set_page_config(page_title="AI 报告排版助手", layout="wide")
    st.markdown(
        """
        <style>
        .stApp { background: #f2f7ff; }
        .block-container { padding-top: 2rem; }
        h1, h2, h3, h4, h5, h6 { color: #0b2a4a; }
        .stTextArea textarea { background: #ffffff; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def _sidebar_config() -> FormatConfig:
    st.sidebar.header("样式设置")
    cn_font = st.sidebar.text_input("中文字体", value="SimSun")
    en_font = st.sidebar.text_input("英文字体", value="Times New Roman")
    heading_size = st.sidebar.number_input("标题字号 (pt)", min_value=8, max_value=48, value=16)
    body_size = st.sidebar.number_input("正文字号 (pt)", min_value=8, max_value=32, value=12)
    line_spacing = st.sidebar.selectbox("行间距", [1.0, 1.25, 1.5, 1.75, 2.0], index=2)
    para_before = st.sidebar.number_input("段前 (pt)", min_value=0, max_value=48, value=0)
    para_after = st.sidebar.number_input("段后 (pt)", min_value=0, max_value=48, value=0)
    first_line = st.sidebar.checkbox("首行缩进 2 字符", value=True)
    clear_bg = st.sidebar.checkbox("清除背景色", value=True)
    page_num_pos = st.sidebar.selectbox("页码位置", ["center", "right"], index=0)

    return FormatConfig(
        cn_font=cn_font,
        en_font=en_font,
        heading_size_pt=heading_size,
        body_size_pt=body_size,
        line_spacing=float(line_spacing),
        para_before_pt=para_before,
        para_after_pt=para_after,
        first_line_indent=first_line,
        clear_background=clear_bg,
        page_num_position=page_num_pos,
    )


def main() -> None:
    _apply_theme()
    st.title("AI 报告排版助手")
    st.caption("Markdown → Word，适配课题报告排版")

    config = _sidebar_config()

    col_input, col_preview = st.columns(2, gap="large")
    with col_input:
        st.subheader("输入区")
        text = st.text_area("粘贴 Markdown 内容", height=400)

    with col_preview:
        st.subheader("结构化预览")
        payload = build_preview_payload(text or "")
        st.write("块数量：", payload["summary"])
        st.write("引用：", payload["refs"])
        st.write("样式参数：", config)

    if st.button("生成并下载 Word 文档"):
        with tempfile.NamedTemporaryFile(suffix=".docx") as tmp:
            build_docx(payload["ast"], tmp.name)
            tmp.seek(0)
            st.download_button(
                label="下载 Word",
                data=tmp.read(),
                file_name="ai-report.docx",
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )


if __name__ == "__main__":
    main()
