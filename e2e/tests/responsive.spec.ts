import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('mobile layout has a menu and no horizontal scroll', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('button', { name: /Menu/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: /Menu/ }).click();
  await page.locator('#mobile-nav').getByRole('link', { name: 'Companies' }).click();
  await expect(page).toHaveURL(/\/companies/);
});
