import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function getRendererUrl({ isPackaged, devServerUrl, appPath }) {
  if (!isPackaged) {
    return devServerUrl;
  }

  const indexPath = path.join(appPath, 'out', 'index.html');
  return pathToFileURL(indexPath).toString();
}

export function getSplashUrl({ electronDir }) {
  const splashPath = path.join(electronDir, 'splash.html');
  return pathToFileURL(splashPath).toString();
}
