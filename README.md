# AI Report Formatter

离线优先的 AI 报告排版桌面应用：把 Markdown 转成可直接提交的 Word 文档（`.docx`）。

适合课程报告、实验报告、项目汇报、学习笔记和技术文档等场景，核心目标是“先写 Markdown，再交 Word”。

## 功能特性

- Markdown 一键导出 Word（`.docx`）
- 实时结构化预览，导出前先检查版式与结构
- 学术风格配置：标题/正文字体、字号、行距、段前后、缩进、页码
- 公式支持：行内与块级公式，块公式自动编号
- 参考文献支持：`IEEE` / `GB-T` / `APA`，支持手工条目与 BibTeX
- 批量导出：使用 `---` 分隔多段内容后批量生成多个文档
- 桌面端日志导出与导出统计（today/total）

## 下载与安装

Release 页面：`https://github.com/BeiZi6/Ai-Report-Formatter/releases`

- macOS：`.dmg`
- Windows：`.exe`
- Linux：`.AppImage`

首次启动提示拦截时：

- macOS：`系统设置 -> 隐私与安全性 -> 仍要打开`
- Windows：SmartScreen 中点击“更多信息 -> 仍要运行”
- Linux：先执行 `chmod +x "AI Report Formatter*.AppImage"`

## 快速开始（本地开发）

### 环境要求

- Node.js 20+
- Python 3.9+

### 安装依赖

```bash
python3 -m pip install -r apps/api/requirements.txt
cd apps/web
npm install
```

桌面联调/打包需要额外依赖：

```bash
python3 -m pip install -r apps/api/requirements-desktop.txt
```

### 启动 API

```bash
uvicorn main:app --reload --port 8000 --app-dir apps/api
```

### 启动 Web

```bash
cd apps/web
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
```

### 启动桌面联调（Web + API + Electron）

```bash
cd apps/web
npm run dev:desktop
```

## 常用命令

```bash
# Python tests（仓库根目录）
pytest tests

# Electron backend tests
cd apps/web
npm run test:electron

# Playwright E2E
npx playwright test

# 构建桌面安装包（dmg/nsis/AppImage）
npm run build:desktop

# 仅打包目录（不产出安装器）
npm run pack:desktop
```

## API 端点

- `GET /healthz`
- `POST /api/preview`
- `POST /api/generate`
- `GET /api/exports/stats`

## 仓库结构

- `apps/web`：Next.js + Electron 桌面应用（主入口）
- `apps/api`：FastAPI 接口层（预览、导出、统计）
- `apps/formatter`：Markdown 解析与 DOCX 生成核心
- `tests`：API/formatter/Electron 相关测试
- `docs`：格式说明、隐私政策、EULA、计划文档

## 文档索引

- 支持格式：`docs/supported-formats.md`
- 更新记录：`CHANGELOG.md`
- 隐私政策：`docs/privacy-policy.md`
- EULA：`docs/eula.md`

## 许可证

详见 `LICENSE`。
