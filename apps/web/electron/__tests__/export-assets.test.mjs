import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("exported index.html uses relative _next asset paths", () => {
  const outIndexPath = path.resolve(import.meta.dirname, "../../out/index.html");
  const html = fs.readFileSync(outIndexPath, "utf8");

  assert.equal(html.includes('href="/_next/'), false);
  assert.equal(html.includes('src="/_next/'), false);
});
