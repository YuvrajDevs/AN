import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN, loginAs } from './helpers';

const PAGES = ['/', '/companies', '/companies/legora', '/funding', '/sectors', '/sectors/legal-ai', '/review', '/watchlists', '/alerts', '/briefs', '/admin'];

test('login page has no serious accessibility violations', async ({ page }) => {
  await page.goto('/login');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id)).toEqual([]);
});

for (const path of PAGES) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await loginAs(page, ADMIN, path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 });
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
    expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });
  for (const path of ['/', '/companies', '/sectors/legal-ai', '/review']) {
    test(`${path} (dark) has no serious accessibility violations`, async ({ page }) => {
      await loginAs(page, ADMIN, path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 });
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
      expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }
});
