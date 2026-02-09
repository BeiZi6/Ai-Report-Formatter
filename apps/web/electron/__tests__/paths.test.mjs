import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { getRendererUrl, getSplashUrl } from "../paths.mjs";

test("returns dev server URL when not packaged", () => {
  const url = getRendererUrl({
    isPackaged: false,
    devServerUrl: "http://localhost:3000",
    appPath: "/repo/apps/web",
  });

  assert.equal(url, "http://localhost:3000");
});

test("returns packaged file URL when packaged", () => {
  const appPath = "/Applications/Formatter.app/Contents/Resources/app.asar";
	const url = getRendererUrl({
		isPackaged: true,
		devServerUrl: "http://localhost:3000",
		appPath,
	});

	assert.equal(url, pathToFileURL(path.join(appPath, "out", "index.html")).toString());
});

test("returns splash file URL under electron directory", () => {
	const splashUrl = getSplashUrl({
		electronDir: "/repo/apps/web/electron",
	});

	assert.equal(
		splashUrl,
		pathToFileURL(path.join("/repo/apps/web/electron", "splash.html")).toString(),
	);
});
