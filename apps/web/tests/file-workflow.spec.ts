import { expect, test } from "@playwright/test";

test("imports markdown from local file", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const fileInput = page.locator('input[type="file"][accept=".md,text/markdown"]');
  await fileInput.setInputFiles({
    name: "demo.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Imported\n\nHello file"),
  });

  await expect(page.locator("#markdown")).toHaveValue("# Imported\n\nHello file");
});

test("supports batch export controls", async ({ page }) => {
  let generateCalls = 0;

  await page.route("**/api/generate", async (route) => {
    generateCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: Buffer.from("pk-docx-mock"),
    });
  });

  await page.route("**/api/exports/stats", async (route) => {
    await route.fulfill({
      json: {
        today: 0,
        total: 0,
      },
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.locator("#markdown").fill("# A\n\nOne\n\n---\n\n# B\n\nTwo");
  await page.getByRole("button", { name: "批量导出" }).click();

  await expect(page.getByText("批量导出任务已完成")).toBeVisible();
  await expect(page.getByText("批量导出失败，请稍后重试")).toHaveCount(0);
  expect(generateCalls).toBe(2);
});
