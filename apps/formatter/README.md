# AI 报告排版助手

Streamlit 小工具：将 Markdown 转成 Word 报告，并支持基础结构化预览。

## 运行

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r apps/formatter/requirements.txt
streamlit run apps/formatter/app.py
```

## 说明

- 当前导出支持标题与段落的基础映射。
- 引用和 LaTeX 转换已提供基础能力。
