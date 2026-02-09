# AI Report Formatter

离线优先的 AI 报告排版工具链：将 Markdown 内容转换为结构化 Word 文档，并提供 Web + Electron 桌面端工作流。

## What this repo includes

- `apps/formatter`: Streamlit 前端与核心格式化管道（Markdown -> DOCX）
- `apps/api`: FastAPI 服务层，提供预览与导出接口
- `apps/web`: Next.js + Electron 桌面壳，支持本地打包与发布
- `docs/`: 合规文档、功能支持说明与设计/实施计划

## Key capabilities

- Markdown 基础结构导出：标题、段落、列表、表格、行内样式
- 数学公式支持：行内与块级公式（含编号）
- 引用标记识别：如 `[1]` 可在预览摘要中体现
- 桌面离线打包：Electron 集成本地 FastAPI 后端
- GitHub Actions 发布链路：支持 tag 触发多平台桌面产物发布

## Quick start

### 1) Install dependencies

```bash
python3 -m pip install -r apps/api/requirements.txt
python3 -m pip install -r apps/api/requirements-desktop.txt
python3 -m pip install -r apps/formatter/requirements.txt
npm --prefix apps/web install
```

### 2) Run desktop dev mode (recommended)

```bash
npm --prefix apps/web run dev:desktop
```

该命令会并行启动：Next.js (`3000`)、FastAPI (`8000`) 与 Electron 壳。

### 3) Optional: run modules separately

```bash
(cd apps/api && uvicorn main:app --reload --port 8000)
streamlit run apps/formatter/app.py
npm --prefix apps/web run dev
```

## Test and build

```bash
npm --prefix apps/web run test:electron
npm --prefix apps/web run build:desktop
```

## Release

- 桌面产物发布工作流：`.github/workflows/release-desktop.yml`（`v*` tag 触发）
- GitHub Release 工作流：`.github/workflows/release-github.yml`（手动触发）
- 变更记录：`CHANGELOG.md`

## Documentation

- 支持格式说明：`docs/supported-formats.md`
- 隐私政策：`docs/privacy-policy.md`
- EULA：`docs/eula.md`
- License：`LICENSE`
