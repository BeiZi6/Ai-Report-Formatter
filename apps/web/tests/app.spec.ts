import { test, expect } from '@playwright/test';

test('landing renders core sections', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await expect(page.getByRole('heading', { name: 'AI 报告排版助手' })).toBeVisible();
  await expect(page.getByLabel('Markdown 输入')).toBeVisible();
  await expect(page.getByRole('button', { name: '生成 Word' })).toBeVisible();
});

test('settings panel includes paragraph spacing and indent controls', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await expect(page.getByLabel('标题段前')).toBeVisible();
  await expect(page.getByLabel('标题段后')).toBeVisible();
  await expect(page.getByLabel('正文段前')).toBeVisible();
  await expect(page.getByLabel('正文段后')).toBeVisible();
  await expect(page.getByLabel('左缩进')).toBeVisible();
  await expect(page.getByLabel('右缩进')).toBeVisible();
  await expect(page.getByLabel('首行缩进')).toBeVisible();
  await expect(page.getByLabel('正文行距')).toBeVisible();
});

test('export note mentions auto numbering and centered tables', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await expect(
    page.getByText('表格单元格默认居中，块级公式自动按 (1) 样式编号', { exact: false }),
  ).toBeVisible();
});

test('preview renders inline code and centered tables', async ({ page }) => {
  await page.route('**/api/preview', async (route) => {
    await route.fulfill({
      json: {
        summary: { headings: 0, paragraphs: 1 },
        refs: [],
        preview_html:
          '<p>Inline <code>code</code></p><table><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
      },
    });
  });

  await page.goto('http://localhost:3000/');
  await page.getByLabel('Markdown 输入').fill('Inline `code`');

  const preview = page.locator('.preview-html');
  await expect(preview.locator('code')).toHaveText('code');
  await expect(preview.locator('table')).toBeVisible();
  await expect(preview.locator('td').first()).toHaveCSS('text-align', 'center');
});

test('long preview paginates into multiple pages', async ({ page }) => {
  const paragraphs = Array.from({ length: 80 }, (_, index) => {
    const content = '内容 '.repeat(18);
    return `<p>段落 ${index + 1}：${content}</p>`;
  }).join('');

  await page.route('**/api/preview', async (route) => {
    await route.fulfill({
      json: {
        summary: { headings: 0, paragraphs: 80 },
        refs: [],
        preview_html: paragraphs,
      },
    });
  });

  await page.goto('http://localhost:3000/');
  await page.getByLabel('Markdown 输入').fill('长文档');
  await expect(page.locator('.preview-html')).toBeVisible();

  await page.waitForFunction(() => document.querySelectorAll('.preview-page').length >= 2);
  const pageCount = await page.locator('.preview-page').count();
  expect(pageCount).toBeGreaterThan(1);
});
