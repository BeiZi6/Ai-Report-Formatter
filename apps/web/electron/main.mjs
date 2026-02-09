import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";

import {
	buildBackendEnv,
	getBackendExecutablePath,
	getBackendReadinessConfig,
	getBackendReadyEndpoint,
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
const BACKEND_READY_ENDPOINT = getBackendReadyEndpoint();
const BACKEND_READINESS = getBackendReadinessConfig();

let backendProcess = null;
let isQuitting = false;
let runtimeLogFilePath = null;

function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
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

async function waitForBundledBackendReady() {
	for (let attempt = 0; attempt < BACKEND_READINESS.attempts; attempt += 1) {
		try {
			const response = await fetch(BACKEND_READY_ENDPOINT);
			if (response.ok) {
				return true;
			}
		} catch {
			// keep polling until timeout
		}

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

function startBundledBackend() {
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
		env: buildBackendEnv(process.env),
		stdio: app.isPackaged ? "ignore" : "inherit",
		windowsHide: true,
	});

	backendProcess.on("exit", (code, signal) => {
		if (!isQuitting && code !== 0) {
			const message = `Bundled backend exited unexpectedly (code=${code}, signal=${signal ?? "none"})`;
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

app.whenReady().then(async () => {
	initializeRuntimeLogging();
	configurePermissionHandlers();

	const launchBundledBackend = shouldLaunchBundledBackend({
		isPackaged: app.isPackaged,
	});
	const splashWindow = launchBundledBackend ? createSplashWindow() : null;

	if (launchBundledBackend) {
		try {
			startBundledBackend();
			void waitForBundledBackendReady()
				.then((isReady) => {
					if (isReady) {
						return;
					}

					appendRuntimeLog({
						level: "error",
						message: "Bundled backend startup timeout",
						context: { endpoint: BACKEND_READY_ENDPOINT },
					});
					dialog.showErrorBox(
						"Backend Startup Timeout",
						`The bundled API did not become ready at ${BACKEND_READY_ENDPOINT}`,
					);
				})
				.catch((error) => {
					reportRuntimeError("Bundled backend startup failed", error);
					const message = error instanceof Error ? error.message : String(error);
					dialog.showErrorBox("Bundled Backend Error", message);
				});
		} catch (error) {
			reportRuntimeError("Bundled backend startup failed", error);
			const message = error instanceof Error ? error.message : String(error);
			dialog.showErrorBox("Bundled Backend Error", message);
		}
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
