import { expect, test } from '@playwright/test';
import { login } from './helpers';

const PAGES = ['/', '/companies', '/companies/legora', '/funding', '/sectors', '/sectors/legal-ai', '/review', '/watchlists', '/alerts', '/briefs'];

test('mobile layout has a menu that navigates', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('button', { name: /Menu/ })).toBeVisible();
  await page.getByRole('button', { name: /Menu/ }).click();
  await page.locator('#mobile-nav').getByRole('link', { name: 'Companies' }).click();
  await expect(page).toHaveURL(/\/companies/);
});

test('no page scrolls horizontally on a phone', async ({ page }) => {
  await login(page);
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
  }
});
