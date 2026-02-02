import { test, expect } from '@playwright/test';

test('landing renders core sections', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await expect(page.getByRole('heading', { name: 'AI 报告排版助手' })).toBeVisible();
  await expect(page.getByLabel('Markdown 输入')).toBeVisible();
  await expect(page.getByRole('button', { name: '生成 Word' })).toBeVisible();
});
