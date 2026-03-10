import path from 'node:path';

export const DESKTOP_API_HOST = '127.0.0.1';
export const DESKTOP_API_PORT = '8000';
const BACKEND_READY_PATH = '/healthz';
const BACKEND_READY_ATTEMPTS = 120;
const BACKEND_READY_INTERVAL_MS = 500;

function getBackendBinaryName(platform) {
  return platform === 'win32' ? 'api-server.exe' : 'api-server';
}

export function getBackendExecutablePath({ isPackaged, platform, resourcesPath, electronDir }) {
  const binaryName = getBackendBinaryName(platform);

  if (isPackaged) {
    return path.join(resourcesPath, 'backend', binaryName);
  }

  return path.join(electronDir, 'backend', binaryName);
}

export function buildBackendBaseUrl({
  host = DESKTOP_API_HOST,
  port = DESKTOP_API_PORT,
} = {}) {
  return `http://${host}:${port}`;
}

export function buildBackendEnv(baseEnv, {
  host = DESKTOP_API_HOST,
  port = DESKTOP_API_PORT,
  exportDbPath,
} = {}) {
  const env = {
    ...baseEnv,
    DESKTOP_API_HOST: host,
    DESKTOP_API_PORT: port,
    API_HOST: host,
    API_PORT: port,
    API_CORS_EXTRA_ORIGINS: 'null',
  };

  if (exportDbPath) {
    env.EXPORT_DB_PATH = exportDbPath;
  }

  return env;
}

export function shouldLaunchBundledBackend({ isPackaged }) {
  return isPackaged;
}

export function getBackendReadyEndpoint({
  host = DESKTOP_API_HOST,
  port = DESKTOP_API_PORT,
} = {}) {
  return `${buildBackendBaseUrl({ host, port })}${BACKEND_READY_PATH}`;
}

export function getBackendReadinessConfig() {
  return {
    attempts: BACKEND_READY_ATTEMPTS,
    intervalMs: BACKEND_READY_INTERVAL_MS,
  };
}

export async function probeBackendReady({ endpoint, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(endpoint);
    return response.ok;
  } catch {
    return false;
  }
}
