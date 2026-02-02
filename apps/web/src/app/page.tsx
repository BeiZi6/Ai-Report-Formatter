'use client';

import { useEffect, useMemo, useState } from 'react';

import { fetchPreview, generateDocx } from '../lib/api';

type PreviewPayload = {
  summary?: {
    headings?: number;
    paragraphs?: number;
  };
  refs?: string[];
};

type FormatConfig = {
  cn_font: string;
  en_font: string;
  heading_font: string;
  heading_size_pt: number;
  body_size_pt: number;
  line_spacing: number;
  para_before_pt: number;
  para_after_pt: number;
  first_line_indent: boolean;
  justify: boolean;
  clear_background: boolean;
  page_num_position: string;
};

const DEFAULT_CONFIG: FormatConfig = {
  cn_font: 'SimSun',
  en_font: 'Times New Roman',
  heading_font: 'SimHei',
  heading_size_pt: 16,
  body_size_pt: 12,
  line_spacing: 1.5,
  para_before_pt: 0,
  para_after_pt: 0,
  first_line_indent: true,
  justify: true,
  clear_background: true,
  page_num_position: 'center',
};

export default function Home() {
  const [markdown, setMarkdown] = useState('');
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<FormatConfig>(DEFAULT_CONFIG);

  const isEmpty = markdown.trim().length === 0;

  useEffect(() => {
    if (isEmpty) {
      setPreview(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchPreview(markdown, controller.signal);
        setPreview(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError('预览失败，请检查接口连接');
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [markdown, isEmpty]);

  const headingCount = preview?.summary?.headings ?? 0;
  const paragraphCount = preview?.summary?.paragraphs ?? 0;
  const refCount = preview?.refs?.length ?? 0;
  const estimatedPages = useMemo(() => {
    if (!paragraphCount) return 0;
    return Math.max(1, Math.ceil(paragraphCount / 6));
  }, [paragraphCount]);

  const statusLabel = useMemo(() => {
    if (isGenerating) return '正在导出';
    if (isLoading) return '分析中…';
    if (error) return '预览失败';
    if (isEmpty) return '等待输入';
    return '已更新';
  }, [error, isEmpty, isGenerating, isLoading]);

  const handleGenerate = async () => {
    if (isEmpty || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await generateDocx(markdown, config);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ai-report.docx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('导出失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

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
              {statusLabel}
            </div>
          </div>

          <div className="field">
            <label htmlFor="markdown">Markdown 输入</label>
            <textarea
              id="markdown"
              name="markdown"
              placeholder="# 报告标题\n\n从这里开始写内容..."
              rows={12}
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
            />
            <p className="hint">支持标题、列表、引用与参考文献标记 [1]</p>
          </div>

          <div className="divider" role="presentation" />

          <div className="config-grid">
            <div className="field compact">
              <label htmlFor="font-cn">中文字体</label>
              <select
                id="font-cn"
                name="font-cn"
                value={config.cn_font}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, cn_font: event.target.value }))
                }
              >
                <option value="SimSun">宋体 SimSun</option>
                <option value="SimHei">黑体 SimHei</option>
                <option value="FangSong">仿宋 FangSong</option>
              </select>
            </div>
            <div className="field compact">
              <label htmlFor="font-en">英文字体</label>
              <select
                id="font-en"
                name="font-en"
                value={config.en_font}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, en_font: event.target.value }))
                }
              >
                <option value="Times New Roman">Times New Roman</option>
                <option value="Arial">Arial</option>
                <option value="Calibri">Calibri</option>
              </select>
            </div>
            <div className="field compact">
              <label htmlFor="line-spacing">行距</label>
              <select
                id="line-spacing"
                name="line-spacing"
                value={String(config.line_spacing)}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    line_spacing: Number.parseFloat(event.target.value),
                  }))
                }
              >
                <option value="1.2">1.2</option>
                <option value="1.5">1.5</option>
                <option value="1.8">1.8</option>
              </select>
            </div>
            <div className="field compact">
              <label htmlFor="indent">首行缩进</label>
              <select
                id="indent"
                name="indent"
                value={config.first_line_indent ? 'true' : 'false'}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    first_line_indent: event.target.value === 'true',
                  }))
                }
              >
                <option value="true">启用</option>
                <option value="false">关闭</option>
              </select>
            </div>
          </div>

          <div className="action-row">
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setMarkdown('')}
            >
              清空内容
            </button>
            <button
              className="primary-btn"
              type="button"
              onClick={handleGenerate}
              disabled={isEmpty || isGenerating}
              aria-disabled={isEmpty || isGenerating}
            >
              {isGenerating ? '生成中…' : '生成 Word'}
            </button>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
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
              <strong className="stat-value">{headingCount}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">引用标记</span>
              <strong className="stat-value">{refCount}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">预计页数</span>
              <strong className="stat-value">{estimatedPages}</strong>
            </div>
          </div>

          <div className="preview-card">
            <div className="preview-header">
              <h3>排版预览</h3>
              <span className="preview-badge">样式：学术简洁</span>
            </div>
            <div className="preview-body">
              {isEmpty ? (
                <p>等待输入 Markdown 后显示结构摘要。</p>
              ) : (
                <>
                  <p>已识别 {paragraphCount} 个段落与 {headingCount} 个标题。</p>
                  <ul>
                    <li>最新引用：{preview?.refs?.[0] ?? '无'}</li>
                    <li>分页建议：约 {estimatedPages} 页</li>
                    <li>字体：{config.cn_font} / {config.en_font}</li>
                  </ul>
                </>
              )}
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
