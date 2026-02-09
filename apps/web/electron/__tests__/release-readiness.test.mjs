import assert from "node:assert/strict";
import test from "node:test";

import {
	buildAllowedNavigationOrigins,
	isNavigationAllowed,
	serializeLogEntry,
	shouldGrantPermission,
} from "../release-readiness.mjs";

test("allows dev-server same-origin navigation", () => {
	const origins = buildAllowedNavigationOrigins({
		isPackaged: false,
		devServerUrl: "http://127.0.0.1:3000",
	});

	assert.equal(
		isNavigationAllowed({
			targetUrl: "http://127.0.0.1:3000/settings",
			allowedOrigins: origins,
		}),
		true,
	);
});

test("blocks external navigation target", () => {
	const origins = buildAllowedNavigationOrigins({
		isPackaged: false,
		devServerUrl: "http://127.0.0.1:3000",
	});

	assert.equal(
		isNavigationAllowed({
			targetUrl: "https://example.com",
			allowedOrigins: origins,
		}),
		false,
	);
});

test("allows file URLs in packaged mode", () => {
	const origins = buildAllowedNavigationOrigins({
		isPackaged: true,
		devServerUrl: "http://127.0.0.1:3000",
	});

	assert.equal(
		isNavigationAllowed({
			targetUrl: "file:///Applications/Formatter.app/Contents/Resources/app.asar/out/index.html",
			allowedOrigins: origins,
		}),
		true,
	);
});

test("denies runtime permission requests by default", () => {
	assert.equal(shouldGrantPermission({ permission: "notifications" }), false);
	assert.equal(shouldGrantPermission({ permission: "media" }), false);
});

test("serializes runtime log entry as JSON line", () => {
	const entry = serializeLogEntry({
		level: "error",
		message: "Failed to start backend",
		timestamp: "2026-02-09T12:00:00.000Z",
		context: { code: 1 },
	});

	assert.equal(entry.endsWith("\n"), true);

	const parsed = JSON.parse(entry);
	assert.equal(parsed.level, "error");
	assert.equal(parsed.message, "Failed to start backend");
	assert.equal(parsed.timestamp, "2026-02-09T12:00:00.000Z");
	assert.equal(parsed.context.code, 1);
});
