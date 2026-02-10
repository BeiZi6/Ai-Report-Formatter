type DesktopBridge = {
  apiBaseUrl?: string;
  getLogFilePath?: () => Promise<string | null>;
  exportLogs?: () => Promise<{
    ok: boolean;
    filePath?: string;
    cancelled?: boolean;
    error?: string;
  }>;
};

export type BibliographyPayload = {
  style: 'ieee' | 'gbt' | 'apa';
  sources_text: string;
};

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

function getApiBase() {
  if (typeof window !== 'undefined' && window.desktop?.apiBaseUrl) {
    return window.desktop.apiBaseUrl;
  }

  return process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';
}

const DEFAULT_TIMEOUT_MS = 12000;

function withTimeout(signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  let didTimeout = false;

  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  return {
    signal: controller.signal,
    timedOut: () => didTimeout,
    cleanup: () => clearTimeout(timer),
  } as const;
}

export async function fetchPreview(
  markdown: string,
  bibliography: BibliographyPayload,
  signal?: AbortSignal,
) {
  const apiBase = getApiBase();
  const { signal: mergedSignal, timedOut, cleanup } = withTimeout(signal);

  try {
    const res = await fetch(`${apiBase}/api/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown, bibliography }),
      signal: mergedSignal,
    });

    if (!res.ok) {
      throw new Error(`Preview request failed: ${res.status}`);
    }

    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError' && timedOut()) {
      throw new Error('timeout');
    }
    throw err;
  } finally {
    cleanup();
  }
}

export async function generateDocx(
  markdown: string,
  config: Record<string, unknown>,
  bibliography: BibliographyPayload,
) {
  const apiBase = getApiBase();
  const { signal: mergedSignal, timedOut, cleanup } = withTimeout();

  try {
    const res = await fetch(`${apiBase}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown, config, bibliography }),
      signal: mergedSignal,
    });

    if (!res.ok) {
      throw new Error(`Generate request failed: ${res.status}`);
    }

    return res.blob();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError' && timedOut()) {
      throw new Error('timeout');
    }
    throw err;
  } finally {
    cleanup();
  }
}

export async function fetchExportStats() {
  const apiBase = getApiBase();
  const { signal: mergedSignal, timedOut, cleanup } = withTimeout();

  try {
    const res = await fetch(`${apiBase}/api/exports/stats`, { signal: mergedSignal });

    if (!res.ok) {
      throw new Error(`Export stats request failed: ${res.status}`);
    }

    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError' && timedOut()) {
      throw new Error('timeout');
    }
    throw err;
  } finally {
    cleanup();
  }
}
