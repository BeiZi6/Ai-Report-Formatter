import { expect, test } from "@playwright/test";

test("renders primary desktop formatter controls", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByRole("heading", { name: "AI 报告排版助手" })).toBeVisible();
	await expect(page.getByLabel("Markdown 输入")).toBeVisible();
	await expect(page.getByTestId("btn-generate")).toBeDisabled();
});

test("enables export action after markdown input", async ({ page }) => {
	await page.goto("/");

	await page.getByLabel("Markdown 输入").fill("# 测试标题\n\n这是测试段落。");
	await expect(page.getByTestId("btn-generate")).toBeEnabled();

	await page.getByRole("button", { name: "清空内容" }).click();
	await expect(page.getByLabel("Markdown 输入")).toHaveValue("");
	await expect(page.getByTestId("btn-generate")).toBeDisabled();
});

test("shows runtime log export action in web mode", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByTestId("btn-export-logs")).toBeVisible();
	await expect(page.getByTestId("btn-export-logs")).toBeDisabled();
});
