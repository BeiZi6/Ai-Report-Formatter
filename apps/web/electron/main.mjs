import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";

import {
	buildBackendBaseUrl,
	buildBackendEnv,
	DESKTOP_API_HOST,
	DESKTOP_API_PORT,
	getBackendExecutablePath,
	getBackendReadinessConfig,
	getBackendReadyEndpoint,
	probeBackendReady,
	shouldLaunchBundledBackend,
} from "./backend.mjs";
import { getRendererUrl, getSplashUrl } from "./paths.mjs";
import {
	buildAllowedNavigationOrigins,
	getLogExportDefaultPath,
	getRuntimeLogFilePath,
	isNavigationAllowed,
	serializeLogEntry,
	shouldGrantPermission,
} from "./release-readiness.mjs";

const DEV_SERVER_URL =
	process.env.ELECTRON_RENDERER_URL ?? "http://localhost:3000";
const BACKEND_READINESS = getBackendReadinessConfig();
const BACKEND_PORT_SCAN_ATTEMPTS = 20;
const BACKEND_STATUS_CHANNEL = "desktop:backend-startup-status";

let backendProcess = null;
let isQuitting = false;
let runtimeLogFilePath = null;
let desktopApiBaseUrl = buildBackendBaseUrl();
let backendReadyEndpoint = getBackendReadyEndpoint();
let backendStartupStatus = {
	phase: "idle",
	progress: 100,
	message: "本地服务待命",
	updatedAt: new Date().toISOString(),
};

function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function pushBackendStartupStatus() {
	for (const windowInstance of BrowserWindow.getAllWindows()) {
		if (windowInstance.isDestroyed()) {
			continue;
		}

		windowInstance.webContents.send(BACKEND_STATUS_CHANNEL, backendStartupStatus);
	}
}

function updateBackendStartupStatus({ phase, progress, message }) {
	backendStartupStatus = {
		phase,
		progress: Math.max(0, Math.min(100, Math.round(progress))),
		message,
		updatedAt: new Date().toISOString(),
	};
	pushBackendStartupStatus();
}

function setDesktopApiBaseUrl({ host, port }) {
	desktopApiBaseUrl = buildBackendBaseUrl({ host, port });
	backendReadyEndpoint = getBackendReadyEndpoint({ host, port });
	process.env.DESKTOP_API_BASE_URL = desktopApiBaseUrl;
}

function canListenOnPort({ host, port }) {
	return new Promise((resolve) => {
		const probe = net.createServer();

		probe.once("error", () => {
			resolve(false);
		});

		probe.once("listening", () => {
			probe.close(() => resolve(true));
		});

		probe.listen({ host, port, exclusive: true });
	});
}

async function resolveBackendPort({ host, preferredPort }) {
	for (let offset = 0; offset < BACKEND_PORT_SCAN_ATTEMPTS; offset += 1) {
		const candidate = preferredPort + offset;
		if (await canListenOnPort({ host, port: candidate })) {
			return candidate;
		}
	}

	throw new Error(
		`No available backend port found in range ${preferredPort}-${preferredPort + BACKEND_PORT_SCAN_ATTEMPTS - 1}`,
	);
}

function buildErrorContext(error) {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}

	return { value: String(error) };
}

function appendRuntimeLog({ level, message, context = {} }) {
	if (!runtimeLogFilePath) {
		return;
	}

	try {
		fs.mkdirSync(path.dirname(runtimeLogFilePath), { recursive: true });
		const entry = serializeLogEntry({
			level,
			message,
			timestamp: new Date().toISOString(),
			context,
		});
		fs.appendFileSync(runtimeLogFilePath, entry, "utf8");
	} catch (error) {
		console.error("Failed to persist runtime log:", error);
	}
}

function reportRuntimeError(message, error) {
	appendRuntimeLog({
		level: "error",
		message,
		context: buildErrorContext(error),
	});
	console.error(message, error);
}

function initializeRuntimeLogging() {
	runtimeLogFilePath = getRuntimeLogFilePath({
		userDataPath: app.getPath("userData"),
	});

	appendRuntimeLog({
		level: "info",
		message: "Electron runtime initialized",
		context: { isPackaged: app.isPackaged },
	});
}

async function exportRuntimeLogs() {
	if (!runtimeLogFilePath || !fs.existsSync(runtimeLogFilePath)) {
		return { ok: false, error: "Runtime logs are not available yet." };
	}

	try {
		const defaultPath = getLogExportDefaultPath({
			downloadsPath: app.getPath("downloads"),
			timestamp: new Date().toISOString(),
		});

		const result = await dialog.showSaveDialog({
			title: "Export Runtime Logs",
			defaultPath,
			filters: [
				{ name: "Log files", extensions: ["log", "txt"] },
			],
		});

		if (result.canceled || !result.filePath) {
			return { ok: false, cancelled: true };
		}

		fs.copyFileSync(runtimeLogFilePath, result.filePath);
		appendRuntimeLog({
			level: "info",
			message: "Runtime logs exported",
			context: { filePath: result.filePath },
		});

		return { ok: true, filePath: result.filePath };
	} catch (error) {
		reportRuntimeError("Failed to export runtime logs", error);
		const reason = error instanceof Error ? error.message : String(error);
		return { ok: false, error: reason };
	}
}

function configurePermissionHandlers() {
	const defaultSession = session.defaultSession;

	if (!defaultSession) {
		return;
	}

	defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
		const granted = shouldGrantPermission({ permission });
		if (!granted) {
			appendRuntimeLog({
				level: "warn",
				message: "Permission request denied",
				context: { permission },
			});
		}
		callback(granted);
	});

	if (typeof defaultSession.setPermissionCheckHandler === "function") {
		defaultSession.setPermissionCheckHandler((_webContents, permission) => {
			return shouldGrantPermission({ permission });
		});
	}
}

async function waitForBundledBackendReady({ endpoint, onProgress }) {
	for (let attempt = 0; attempt < BACKEND_READINESS.attempts; attempt += 1) {
		const isReady = await probeBackendReady({ endpoint });
		if (isReady) {
			return true;
		}

		onProgress?.(attempt + 1, BACKEND_READINESS.attempts);

		await wait(BACKEND_READINESS.intervalMs);
	}

	return false;
}

function stopBundledBackend() {
	if (!backendProcess || backendProcess.killed) {
		return;
	}

	backendProcess.kill();
}

function startBundledBackend({ host, port, exportDbPath }) {
	const backendExecutable = getBackendExecutablePath({
		isPackaged: app.isPackaged,
		platform: process.platform,
		resourcesPath: process.resourcesPath,
		electronDir: import.meta.dirname,
	});

	if (!fs.existsSync(backendExecutable)) {
		throw new Error(
			`Bundled backend executable not found at ${backendExecutable}`,
		);
	}

	backendProcess = spawn(backendExecutable, [], {
		env: buildBackendEnv(process.env, { host, port, exportDbPath }),
		stdio: app.isPackaged ? "ignore" : "inherit",
		windowsHide: true,
	});

	backendProcess.on("exit", (code, signal) => {
		if (!isQuitting && code !== 0) {
			const message = `Bundled backend exited unexpectedly (code=${code}, signal=${signal ?? "none"})`;
			updateBackendStartupStatus({
				phase: "error",
				progress: 100,
				message: "本地服务已退出，请重启应用",
			});
			appendRuntimeLog({
				level: "error",
				message,
				context: { code, signal: signal ?? "none" },
			});
			console.error(message);
		}
		backendProcess = null;
	});

	backendProcess.on("error", (error) => {
		updateBackendStartupStatus({
			phase: "error",
			progress: 100,
			message: "本地服务启动失败",
		});
		reportRuntimeError("Failed to start bundled backend", error);
	});
}

function closeWindow(windowInstance) {
	if (!windowInstance || windowInstance.isDestroyed()) {
		return;
	}

	windowInstance.close();
}

function createSplashWindow() {
	const splashWindow = new BrowserWindow({
		width: 480,
		height: 320,
		resizable: false,
		minimizable: false,
		maximizable: false,
		fullscreenable: false,
		show: false,
		frame: false,
		transparent: false,
		autoHideMenuBar: true,
		backgroundColor: "#f3f3f3",
		webPreferences: {
			defaultEncoding: "UTF-8",
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			devTools: !app.isPackaged,
		},
	});

	splashWindow.once("ready-to-show", () => {
		splashWindow.show();
	});

	const splashUrl = getSplashUrl({ electronDir: import.meta.dirname });
	void splashWindow.loadURL(splashUrl);

	return splashWindow;
}

function createWindow({ splashWindow } = {}) {
	const mainWindow = new BrowserWindow({
		width: 1360,
		height: 900,
		minWidth: 1024,
		minHeight: 720,
		show: false,
		autoHideMenuBar: true,
		backgroundColor: "#0f1116",
		webPreferences: {
			preload: path.join(import.meta.dirname, "preload.mjs"),
			defaultEncoding: "UTF-8",
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			devTools: !app.isPackaged,
		},
	});

	const rendererUrl = getRendererUrl({
		isPackaged: app.isPackaged,
		devServerUrl: DEV_SERVER_URL,
		appPath: app.getAppPath(),
	});
	const allowedNavigationOrigins = buildAllowedNavigationOrigins({
		isPackaged: app.isPackaged,
		devServerUrl: DEV_SERVER_URL,
	});

	const revealMainWindow = () => {
		closeWindow(splashWindow);
		if (!mainWindow.isDestroyed()) {
			mainWindow.show();
		}
	};

	mainWindow.once("ready-to-show", revealMainWindow);
	mainWindow.webContents.once("did-finish-load", () => {
		mainWindow.webContents.send(BACKEND_STATUS_CHANNEL, backendStartupStatus);
	});

	void mainWindow.loadURL(rendererUrl).catch((error) => {
		reportRuntimeError("Failed to load renderer URL", error);
		revealMainWindow();
	});

	mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
		if (isNavigationAllowed({ targetUrl, allowedOrigins: allowedNavigationOrigins })) {
			return;
		}

		event.preventDefault();
		appendRuntimeLog({
			level: "warn",
			message: "Blocked navigation outside allowlist",
			context: { targetUrl },
		});

		if (/^https?:\/\//i.test(targetUrl)) {
			void shell.openExternal(targetUrl);
		}
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url);
		return { action: "deny" };
	});
}

ipcMain.handle("desktop:ping", () => "pong");
ipcMain.handle("desktop:get-log-file-path", () => runtimeLogFilePath);
ipcMain.handle("desktop:export-logs", async () => exportRuntimeLogs());
ipcMain.handle("desktop:get-backend-startup-status", () => backendStartupStatus);

app.whenReady().then(async () => {
	initializeRuntimeLogging();
	configurePermissionHandlers();
	setDesktopApiBaseUrl({ host: DESKTOP_API_HOST, port: DESKTOP_API_PORT });

	const launchBundledBackend = shouldLaunchBundledBackend({
		isPackaged: app.isPackaged,
	});
	const splashWindow = launchBundledBackend ? createSplashWindow() : null;

	if (launchBundledBackend) {
		const exportDbPath = path.join(app.getPath("userData"), "backend", "export_counts.db");
		updateBackendStartupStatus({
			phase: "starting",
			progress: 5,
			message: "正在准备本地服务...",
		});

		try {
			const backendPort = await resolveBackendPort({
				host: DESKTOP_API_HOST,
				preferredPort: Number(DESKTOP_API_PORT),
			});
			updateBackendStartupStatus({
				phase: "starting",
				progress: 18,
				message: "正在分配服务端口...",
			});

			setDesktopApiBaseUrl({
				host: DESKTOP_API_HOST,
				port: String(backendPort),
			});
			appendRuntimeLog({
				level: "info",
				message: "Desktop backend endpoint configured",
				context: {
					baseUrl: desktopApiBaseUrl,
					exportDbPath,
					readyEndpoint: backendReadyEndpoint,
				},
			});

			updateBackendStartupStatus({
				phase: "starting",
				progress: 30,
				message: "正在启动本地服务进程...",
			});

			startBundledBackend({
				host: DESKTOP_API_HOST,
				port: String(backendPort),
				exportDbPath,
			});

			let lastProgress = 30;
			void waitForBundledBackendReady({
				endpoint: backendReadyEndpoint,
				onProgress: (attempt, total) => {
					const ratio = total > 0 ? attempt / total : 0;
					const nextProgress = Math.min(95, 30 + Math.round(ratio * 65));
					if (nextProgress <= lastProgress) {
						return;
					}

					lastProgress = nextProgress;
					updateBackendStartupStatus({
						phase: "starting",
						progress: nextProgress,
						message: "正在等待本地服务就绪...",
					});
				},
			})
				.then((isReady) => {
					if (isReady) {
						updateBackendStartupStatus({
							phase: "ready",
							progress: 100,
							message: "本地服务已就绪",
						});
						return;
					}

					updateBackendStartupStatus({
						phase: "error",
						progress: 100,
						message: "本地服务启动超时",
					});

					appendRuntimeLog({
						level: "error",
						message: "Bundled backend startup timeout",
						context: { endpoint: backendReadyEndpoint },
					});
					dialog.showErrorBox(
						"Backend Startup Timeout",
						`The bundled API did not become ready at ${backendReadyEndpoint}`,
					);
				})
				.catch((error) => {
					updateBackendStartupStatus({
						phase: "error",
						progress: 100,
						message: "本地服务启动失败",
					});
					reportRuntimeError("Bundled backend startup failed", error);
					const message = error instanceof Error ? error.message : String(error);
					dialog.showErrorBox("Bundled Backend Error", message);
				});
		} catch (error) {
			updateBackendStartupStatus({
				phase: "error",
				progress: 100,
				message: "本地服务启动失败",
			});
			reportRuntimeError("Bundled backend startup failed", error);
			const message = error instanceof Error ? error.message : String(error);
			dialog.showErrorBox("Bundled Backend Error", message);
		}
	} else {
		updateBackendStartupStatus({
			phase: "starting",
			progress: 8,
			message: "正在检查开发后端...",
		});

		let lastProgress = 8;
		void waitForBundledBackendReady({
			endpoint: backendReadyEndpoint,
			onProgress: (attempt, total) => {
				const ratio = total > 0 ? attempt / total : 0;
				const nextProgress = Math.min(95, 8 + Math.round(ratio * 87));
				if (nextProgress <= lastProgress) {
					return;
				}

				lastProgress = nextProgress;
				updateBackendStartupStatus({
					phase: "starting",
					progress: nextProgress,
					message: "正在等待开发后端就绪...",
				});
			},
		})
			.then((isReady) => {
				if (isReady) {
					updateBackendStartupStatus({
						phase: "ready",
						progress: 100,
						message: "开发后端已就绪",
					});
					return;
				}

				updateBackendStartupStatus({
					phase: "error",
					progress: 100,
					message: "未检测到开发后端，请先启动 API 服务",
				});

				appendRuntimeLog({
					level: "warn",
					message: "Development backend readiness check timed out",
					context: { endpoint: backendReadyEndpoint },
				});
			})
			.catch((error) => {
				updateBackendStartupStatus({
					phase: "error",
					progress: 100,
					message: "开发后端检查失败",
				});
				reportRuntimeError("Development backend readiness check failed", error);
			});
	}

	createWindow({ splashWindow });

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on("before-quit", () => {
	isQuitting = true;
	stopBundledBackend();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
