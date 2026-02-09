import path from "node:path";

const FILE_SCHEME_SENTINEL = "file://";

function parseOrigin(url) {
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
}

export function buildAllowedNavigationOrigins({ isPackaged, devServerUrl }) {
	const origins = new Set();
	const devServerOrigin = parseOrigin(devServerUrl);

	if (devServerOrigin) {
		origins.add(devServerOrigin);
	}

	if (isPackaged) {
		origins.add(FILE_SCHEME_SENTINEL);
	}

	return origins;
}

export function isNavigationAllowed({ targetUrl, allowedOrigins }) {
	let target;

	try {
		target = new URL(targetUrl);
	} catch {
		return false;
	}

	if (target.protocol === "file:") {
		return allowedOrigins.has(FILE_SCHEME_SENTINEL);
	}

	return allowedOrigins.has(target.origin);
}

export function shouldGrantPermission() {
	return false;
}

export function serializeLogEntry({ level, message, timestamp, context = {} }) {
	return `${JSON.stringify({
		level,
		message,
		timestamp,
		context,
	})}\n`;
}

export function getRuntimeLogFilePath({ userDataPath }) {
	return path.join(userDataPath, "logs", "runtime.log");
}

export function getLogExportDefaultPath({ downloadsPath, timestamp }) {
	const suffix = timestamp.replaceAll(":", "-");
	return path.join(downloadsPath, `ai-report-formatter-runtime-${suffix}.log`);
}
