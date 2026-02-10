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

test("renders react-bits enhanced text accents", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByTestId("rb-hero-shiny")).toBeVisible();
	await expect(page.getByTestId("rb-status-decrypt")).toBeVisible();
	await expect(page.getByTestId("rb-hero-blur")).toBeVisible();
	await expect(page.getByTestId("rb-value-strip")).toBeVisible();
	await expect(page.getByTestId("rb-bg-squares")).toBeVisible();
	await expect(page.locator('[data-testid="rb-bg-squares"] canvas')).toHaveAttribute(
		"data-gravity-enabled",
		"true",
	);
	await expect(page.locator('[data-testid="rb-bg-squares"] canvas')).toHaveAttribute(
		"data-gravity-axis",
		"y-down",
	);
	await expect(page.locator('[data-testid="rb-bg-squares"] canvas')).toHaveAttribute(
		"data-bg-style",
		"dither",
	);
	await expect(page.locator('[data-ui-glass="fluid"]')).toBeVisible();
	await expect(page.locator('[data-gradual-blur="true"]')).toHaveCount(1);
	await expect(page.locator('.page > [data-gradual-blur="true"][data-gradual-blur-scope="global"]')).toHaveCount(1);
	await expect(page.locator('.page [data-gradual-provider="react-bits-shadcn"]')).toHaveCount(1);
	await expect(page.locator('.page [data-testid="rb-bg-squares"]')).toHaveCount(0);
});

test("switches visual theme from selector", async ({ page }) => {
	await page.goto("/");

	const selector = page.getByTestId("theme-select");
	await expect(selector).toBeVisible();

	await selector.selectOption("midnight");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");

	await selector.selectOption("retro");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "retro");

	await selector.selectOption("aurora");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "aurora");

	await selector.selectOption("sunset");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "sunset");

	await selector.selectOption("ocean");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");

	await selector.selectOption("ember");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "ember");

	await selector.selectOption("jade");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "jade");

	await selector.selectOption("graphite");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");

	await selector.selectOption("mono");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "mono");

	await selector.selectOption("dopamine");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dopamine");
});
