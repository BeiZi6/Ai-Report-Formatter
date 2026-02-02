export default function Home() {
  return (
    <div className="page">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <header className="hero reveal delay-1">
        <div className="hero-badge">FastAPI · Next.js · Word</div>
        <h1 className="hero-title">AI 报告排版助手</h1>
        <p className="hero-subtitle">
          把 Markdown 变成干净、专业、可交付的 Word 文档。左侧编辑，右侧即时预览摘要。
        </p>
        <div className="hero-meta">
          <span>两栏工作台</span>
          <span className="dot" aria-hidden="true">
            •
          </span>
          <span>可配置字体与版式</span>
          <span className="dot" aria-hidden="true">
            •
          </span>
          <span>一键导出</span>
        </div>
      </header>

      <main id="main-content" className="workspace reveal delay-2">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">输入与配置</p>
              <h2 className="panel-title">Markdown 工作区</h2>
            </div>
            <div className="status-pill" aria-live="polite">
              已保存
            </div>
          </div>

          <div className="field">
            <label htmlFor="markdown">Markdown 输入</label>
            <textarea
              id="markdown"
              name="markdown"
              placeholder="# 报告标题\n\n从这里开始写内容..."
              rows={12}
            />
            <p className="hint">支持标题、列表、引用与参考文献标记 [1]</p>
          </div>

          <div className="divider" role="presentation" />

          <div className="config-grid">
            <div className="field compact">
              <label htmlFor="font-cn">中文字体</label>
              <select id="font-cn" name="font-cn" defaultValue="SimSun">
                <option value="SimSun">宋体 SimSun</option>
                <option value="SimHei">黑体 SimHei</option>
                <option value="FangSong">仿宋 FangSong</option>
              </select>
            </div>
            <div className="field compact">
              <label htmlFor="font-en">英文字体</label>
              <select id="font-en" name="font-en" defaultValue="Times New Roman">
                <option value="Times New Roman">Times New Roman</option>
                <option value="Arial">Arial</option>
                <option value="Calibri">Calibri</option>
              </select>
            </div>
            <div className="field compact">
              <label htmlFor="line-spacing">行距</label>
              <select id="line-spacing" name="line-spacing" defaultValue="1.5">
                <option value="1.2">1.2</option>
                <option value="1.5">1.5</option>
                <option value="1.8">1.8</option>
              </select>
            </div>
            <div className="field compact">
              <label htmlFor="indent">首行缩进</label>
              <select id="indent" name="indent" defaultValue="true">
                <option value="true">启用</option>
                <option value="false">关闭</option>
              </select>
            </div>
          </div>

          <div className="action-row">
            <button className="ghost-btn" type="button">
              清空内容
            </button>
            <button className="primary-btn" type="button">
              生成 Word
            </button>
          </div>
        </section>

        <section className="panel preview-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">预览摘要</p>
              <h2 className="panel-title">结构概览</h2>
            </div>
            <div className="meta-chip">今日已导出 3 次</div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">标题数</span>
              <strong className="stat-value">2</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">引用标记</span>
              <strong className="stat-value">1</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">预计页数</span>
              <strong className="stat-value">4</strong>
            </div>
          </div>

          <div className="preview-card">
            <div className="preview-header">
              <h3>排版预览</h3>
              <span className="preview-badge">样式：学术简洁</span>
            </div>
            <div className="preview-body">
              <p>
                标题层级清晰，段落对齐统一，页码与参考文献已准备好生成。
              </p>
              <ul>
                <li>标题 1：研究背景</li>
                <li>标题 2：方法与结果</li>
                <li>引用：[1] Zhao, 2024</li>
              </ul>
            </div>
          </div>

          <div className="note-box">
            <h4>导出提示</h4>
            <p>点击“生成 Word”后会自动下载 docx 文件，并保持当前样式。</p>
          </div>
        </section>
      </main>
    </div>
  );
}
