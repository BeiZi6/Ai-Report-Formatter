import path from 'node:path';

export const DESKTOP_API_HOST = '127.0.0.1';
export const DESKTOP_API_PORT = '8000';
export const DESKTOP_API_BASE_URL = `http://${DESKTOP_API_HOST}:${DESKTOP_API_PORT}`;
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

export function buildBackendEnv(baseEnv) {
  return {
    ...baseEnv,
    DESKTOP_API_HOST,
    DESKTOP_API_PORT,
    API_CORS_EXTRA_ORIGINS: 'null',
  };
}

export function shouldLaunchBundledBackend({ isPackaged }) {
  return isPackaged;
}

export function getBackendReadyEndpoint() {
  return `${DESKTOP_API_BASE_URL}${BACKEND_READY_PATH}`;
}

export function getBackendReadinessConfig() {
  return {
    attempts: BACKEND_READY_ATTEMPTS,
    intervalMs: BACKEND_READY_INTERVAL_MS,
  };
}
