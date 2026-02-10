# AI Report Formatter 安装与使用指南

AI Report Formatter 是一款离线优先的桌面应用，用于将 Markdown 内容转换并导出为 Word 文档（`.docx`）。

适用于课程报告、实验报告、项目汇报、学习笔记、技术文档等需要“先写 Markdown，再交 Word”的场景。

当前稳定版本建议使用 `v0.1.5` 及以上，以获得更完整的桌面打包与 Windows 导出稳定性修复。

## 1. 功能概览

- Markdown 转 Word（`.docx`）
- 实时结构化预览，先检查再导出
- 支持数学公式（行内/块级），块公式支持编号
- 支持标题、列表、表格、行内样式等常用语法
- 本地处理为主，适合离线或弱网环境

## 2. 下载与安装

### 2.1 下载地址

- GitHub Releases：
  `https://github.com/BeiZi6/Ai-Report-Formatter/releases`

请优先下载最新版本（推荐 `v0.1.5` 及以上，以获得更稳定的 Windows 导出体验）。

### 2.2 选择安装包

- macOS：`.dmg`
- Windows：`.exe`
- Linux：`.AppImage`（如该版本有提供）

### 2.3 macOS 安装步骤

1. 下载 `.dmg` 安装包并双击打开。
2. 将 `AI Report Formatter.app` 拖入 `Applications`。
3. 首次启动时若提示“无法验证开发者”，请到：
   `系统设置 -> 隐私与安全性`，选择“仍要打开”。

### 2.4 Windows 安装步骤

1. 下载 `.exe` 安装包并双击运行。
2. 按安装向导完成安装。
3. 若出现 SmartScreen 提示，请点击“更多信息 -> 仍要运行”。
4. 安装完成后，从开始菜单启动应用。

### 2.5 Linux 运行步骤（AppImage）

1. 下载 `.AppImage` 文件。
2. 赋予执行权限：
   `chmod +x "AI Report Formatter*.AppImage"`
3. 双击或在终端执行启动。

## 3. 首次启动检查

首次进入应用后，建议先做 3 件事：

1. 确认界面可以正常输入 Markdown。
2. 点击预览，确认标题/段落结构显示正常。
3. 尝试导出一个简单文档，确认本机导出链路可用。

## 4. 详细使用流程

### 步骤 1：准备 Markdown 内容

建议先在编辑器中整理好以下结构：

- 标题层级（`#` ~ `####`）
- 段落与列表
- 表格
- 数学公式（LaTeX）

### 步骤 2：粘贴内容并调整样式

在左侧输入区粘贴 Markdown，并按需要调整样式参数（如字体、字号、行距、段前后距、缩进、页码位置等）。

### 步骤 3：检查预览结果

重点检查：

- 标题是否分级正确
- 列表缩进与编号是否符合预期
- 表格是否对齐
- 公式是否被正确识别

### 步骤 4：导出 Word

点击“生成 Word”后会下载 `.docx` 文件。

建议将导出的 Word 作为“可编辑底稿”，在 Word 中做最后的人工微调（封面、目录、页眉页脚、学校模板细节等）。

## 5. 当前支持的 Markdown 能力

- 标题：`#` 到 `####`
- 文本样式：加粗、斜体、删除线、高亮、上下标、行内代码
- 列表：有序/无序列表，支持嵌套
- 表格：标准 Markdown 表格
- 数学公式：行内 `$...$`、块级 `$$...$$`（块公式支持编号）
- 引用标记：如 `[1]`

示例与说明见：`docs/supported-formats.md`

## 6. 常见问题与排查

### 6.1 导出失败怎么办？

请按以下顺序排查：

1. 确认应用版本为最新（建议 `v0.1.5` 及以上）。
2. 用最小内容测试导出（如 `# Title\n\nHello`）。
3. 避免一次粘贴超大内容（先分段测试）。
4. 在应用中点击“导出运行日志”，将日志提供给维护者定位。

### 6.2 Windows 上之前能导出、现在不行？

请先升级到最新版本。`v0.1.5` 对 Windows 导出稳定性做了专项修复。

### 6.3 是否必须联网？

不是。该工具以本地处理为主，可在离线环境使用。

## 7. 升级建议

每次发布新版本后，建议：

1. 从 Releases 下载新安装包。
2. 覆盖安装（或卸载旧版后安装新版）。
3. 用一份常用文档做一次导出回归测试。

## 8. 版本与链接

- Release 列表：`https://github.com/BeiZi6/Ai-Report-Formatter/releases`
- 变更记录：`CHANGELOG.md`

## 9. 隐私与协议

- 隐私政策：`docs/privacy-policy.md`
- EULA：`docs/eula.md`
- License：`LICENSE`

## 10. 仓库结构（源码）

- `apps/web`：Next.js + Electron 桌面端（主应用入口）
- `apps/api`：FastAPI 服务，提供预览与导出接口
- `apps/formatter`：Markdown 到 DOCX 的核心格式化库
- `docs`：隐私政策、EULA、格式支持说明等文档

## 11. 本地开发快速开始

### 11.1 环境要求

- Node.js（建议 20+）
- Python（>=3.9）

### 11.2 启动 API（FastAPI）

```bash
python3 -m pip install -r apps/api/requirements.txt
uvicorn main:app --reload --port 8000 --app-dir apps/api
```

### 11.3 启动 Web（Next.js）

```bash
cd apps/web
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
```

### 11.4 启动桌面联调模式（Web + API + Electron）

```bash
python3 -m pip install -r apps/api/requirements-desktop.txt
cd apps/web
npm run dev:desktop
```

### 11.5 常用测试命令

```bash
cd apps/web
npm run test:electron
npx playwright test
```
