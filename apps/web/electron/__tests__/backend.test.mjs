import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
	buildBackendEnv,
	getBackendExecutablePath,
	getBackendReadinessConfig,
	getBackendReadyEndpoint,
	shouldLaunchBundledBackend,
} from "../backend.mjs";

test("uses resources backend path in packaged apps", () => {
	const executablePath = getBackendExecutablePath({
		isPackaged: true,
		platform: "darwin",
		resourcesPath: "/Applications/App.app/Contents/Resources",
		electronDir: "/repo/apps/web/electron",
	});

	assert.equal(
		executablePath,
		"/Applications/App.app/Contents/Resources/backend/api-server",
	);
});

test("uses development backend path in unpackaged mode", () => {
	const executablePath = getBackendExecutablePath({
		isPackaged: false,
		platform: "win32",
		resourcesPath: "C:/ignored",
		electronDir: "C:/repo/apps/web/electron",
	});

	assert.equal(
		executablePath,
		path.join("C:/repo/apps/web/electron", "backend", "api-server.exe"),
	);
});

test("builds backend environment with desktop defaults", () => {
	const env = buildBackendEnv({ BASE: "ok" });

	assert.equal(env.BASE, "ok");
	assert.equal(env.DESKTOP_API_HOST, "127.0.0.1");
	assert.equal(env.DESKTOP_API_PORT, "8000");
	assert.equal(env.API_CORS_EXTRA_ORIGINS, "null");
});

test("only auto-launches bundled backend in packaged mode", () => {
	assert.equal(shouldLaunchBundledBackend({ isPackaged: true }), true);
	assert.equal(shouldLaunchBundledBackend({ isPackaged: false }), false);
});

test("readiness timeout budget is sufficient for cold starts", () => {
	const config = getBackendReadinessConfig();
	const totalMs = config.attempts * config.intervalMs;

	assert.ok(totalMs >= 45_000);
});

test("uses lightweight health endpoint for readiness checks", () => {
	assert.equal(getBackendReadyEndpoint(), "http://127.0.0.1:8000/healthz");
});
