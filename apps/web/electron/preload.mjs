/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

const DESKTOP_API_BASE_URL = "http://127.0.0.1:8000";

contextBridge.exposeInMainWorld("desktop", {
  apiBaseUrl: DESKTOP_API_BASE_URL,
  platform: process.platform,
  ping: () => ipcRenderer.invoke("desktop:ping"),
  getLogFilePath: () => ipcRenderer.invoke("desktop:get-log-file-path"),
  exportLogs: () => ipcRenderer.invoke("desktop:export-logs"),
});
