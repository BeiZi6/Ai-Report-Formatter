const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export async function fetchPreview(markdown: string, signal?: AbortSignal) {
  const res = await fetch(`${API_BASE}/api/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Preview request failed: ${res.status}`);
  }

  return res.json();
}

export async function generateDocx(
  markdown: string,
  config: Record<string, unknown>,
) {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, config }),
  });

  if (!res.ok) {
    throw new Error(`Generate request failed: ${res.status}`);
  }

  return res.blob();
}
