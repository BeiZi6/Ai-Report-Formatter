import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
	buildBackendBaseUrl,
	buildBackendEnv,
	getBackendExecutablePath,
	getBackendReadinessConfig,
	getBackendReadyEndpoint,
	probeBackendReady,
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
		path.join("/Applications/App.app/Contents/Resources", "backend", "api-server"),
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
	assert.equal(env.API_HOST, "127.0.0.1");
	assert.equal(env.API_PORT, "8000");
	assert.equal(env.API_CORS_EXTRA_ORIGINS, "null");
});

test("supports overriding backend host and port", () => {
	assert.equal(
		buildBackendBaseUrl({ host: "127.0.0.1", port: "8012" }),
		"http://127.0.0.1:8012",
	);

	const env = buildBackendEnv({}, { host: "127.0.0.1", port: "8012" });
	assert.equal(env.DESKTOP_API_HOST, "127.0.0.1");
	assert.equal(env.DESKTOP_API_PORT, "8012");
	assert.equal(env.API_HOST, "127.0.0.1");
	assert.equal(env.API_PORT, "8012");
	assert.equal(
		getBackendReadyEndpoint({ host: "127.0.0.1", port: "8012" }),
		"http://127.0.0.1:8012/healthz",
	);
});

test("injects export db path when provided", () => {
	const env = buildBackendEnv({}, {
		host: "127.0.0.1",
		port: "8001",
		exportDbPath: "/tmp/export_counts.db",
	});

	assert.equal(env.EXPORT_DB_PATH, "/tmp/export_counts.db");
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

test("reports backend ready when health endpoint returns ok", async () => {
	const isReady = await probeBackendReady({
		endpoint: "http://127.0.0.1:8000/healthz",
		fetchImpl: async () => ({ ok: true }),
	});

	assert.equal(isReady, true);
});

test("reports backend not ready when health endpoint is non-200", async () => {
	const isReady = await probeBackendReady({
		endpoint: "http://127.0.0.1:8000/healthz",
		fetchImpl: async () => ({ ok: false }),
	});

	assert.equal(isReady, false);
});

test("reports backend not ready when health probe throws", async () => {
	const isReady = await probeBackendReady({
		endpoint: "http://127.0.0.1:8000/healthz",
		fetchImpl: async () => {
			throw new Error("network");
		},
	});

	assert.equal(isReady, false);
});
