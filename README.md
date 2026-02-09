# AI Report Formatter 用户说明书

AI Report Formatter 是一款离线优先的桌面工具，用于把 Markdown 内容整理并导出为 Word 文档（`.docx`）。

如果你正在写课程报告、项目汇报、技术文档或研究笔记，可以直接用它把 Markdown 内容快速变成结构清晰的 Word 文件。

## 1. 你能用它做什么

- 将 Markdown 转成 Word，并保留常见排版结构
- 预览导出内容，减少反复试错
- 处理数学公式（行内/块级）并支持块公式编号
- 支持表格、列表、行内样式、引用标记等常用写法
- 在本机完成处理，适合离线场景

## 2. 如何获取应用

请从 GitHub Releases 页面下载最新版安装包：

- Releases: `https://github.com/BeiZi6/Ai-Report--Formatter/releases`

常见安装包类型：

- macOS: `.dmg`
- Windows: `.exe`
- Linux: `.AppImage`

下载后按系统常规安装流程完成安装并启动应用即可。

## 3. 快速上手（用户流程）

### 步骤 1：准备 Markdown 内容

将你的正文、标题、列表、表格、公式等内容按 Markdown 语法写好。

### 步骤 2：粘贴或输入内容

打开应用后，将 Markdown 内容粘贴到编辑区。

### 步骤 3：预览排版结果

在预览区检查结构是否正确（例如标题层级、列表缩进、表格和公式显示）。

### 步骤 4：导出 Word

确认预览无误后导出 `.docx` 文件，用于提交或进一步人工微调。

## 4. 支持的 Markdown 能力（当前）

- 标题：`#` 到 `####`
- 文本样式：加粗、斜体、删除线、高亮、上下标、行内代码
- 列表：有序/无序列表，支持嵌套
- 表格：标准 Markdown 表格
- 数学公式：行内 `$...$`，块级 `$$...$$`（块公式支持编号）
- 引用标记：如 `[1]`

完整示例可见：`docs/supported-formats.md`

## 5. 使用建议

- 导出前先在预览区检查标题层级和列表缩进
- 数学公式建议优先使用标准 LaTeX 写法
- 正式提交前建议在 Word 中进行最后一次人工检查

## 6. 常见问题

### 是否支持离线使用？

支持。该工具以本地处理流程为主，适合无网或弱网环境。

### 适用于哪些系统？

提供 macOS、Windows、Linux 的桌面安装包。

### 在哪里看版本更新？

- Release 列表：`https://github.com/BeiZi6/Ai-Report--Formatter/releases`
- 变更记录：`CHANGELOG.md`

## 7. 隐私与合规

- 隐私政策：`docs/privacy-policy.md`
- EULA：`docs/eula.md`
- License：`LICENSE`
