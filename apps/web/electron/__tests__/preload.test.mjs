import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

test("preload script is valid classic script syntax", () => {
  const preloadPath = path.resolve(import.meta.dirname, "../preload.mjs");
  const source = fs.readFileSync(preloadPath, "utf8");

  assert.doesNotThrow(() => {
    // Electron runs sandboxed preload as classic script, not ESM module.
    new vm.Script(source, { filename: preloadPath });
  });
});
