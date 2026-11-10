import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('redirects signed-out users to login and rejects bad passwords', async ({ page }) => {
  await page.goto('/companies');
  await expect(page).toHaveURL(/\/login\?next=%2Fcompanies/);
  await page.getByLabel('Email').fill('analyst@strata.local');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid email or password' })).toBeVisible();
});

test('landing page leads to a prefilled sign-in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Try the live demo/ }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel('Email')).toHaveValue('analyst@strata.local');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test('dashboard shows seeded data', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect(page.getByText('Companies tracked')).toBeVisible();
  await expect(page.getByRole('link', { name: /Legal AI/ }).first()).toBeVisible();
});

test('search, open a company profile and see its Form D funding timeline', async ({ page }) => {
  await login(page, '/companies');
  await page.getByRole('searchbox').fill('legora');
  await expect(page).toHaveURL(/q=legora/);
  await page.getByRole('link', { name: /Legora/ }).first().click();
  await expect(page.getByRole('heading', { name: /Legora/ })).toBeVisible();
  await expect(page.getByText('Funding timeline')).toBeVisible();
  await expect(page.getByText('Reg D offering').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /SEC Form D/ }).first()).toHaveAttribute('href', /sec\.gov/);
});

test('sector landscape renders a market map', async ({ page }) => {
  await login(page, '/sectors/legal-ai');
  await expect(page.getByRole('heading', { name: 'Legal AI landscape' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contracts & CLM' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Funding by year' })).toBeVisible();
});

test('command palette navigates by keyboard', async ({ page }) => {
  await login(page);
  await page.keyboard.press('Control+k');
  const box = page.getByRole('combobox');
  await expect(box).toBeFocused();
  await box.fill('ironclad');
  await expect(page.getByRole('option', { name: /Ironclad/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/companies\/ironclad/);
});

test('analyst resolves a review item with the keyboard', async ({ page }) => {
  await login(page, '/review');
  const counter = page.getByText(/\d+ pending/);
  await expect(counter).toBeVisible();
  const before = Number((await counter.textContent())!.match(/(\d+) pending/)![1]);
  await page.keyboard.press('0'); // mark out of scope
  await expect(page.getByRole('status').filter({ hasText: 'out of scope' })).toBeVisible();
  await expect(counter).toHaveText(new RegExp(`${before - 1} pending`));
});

test('generates a cited analyst brief', async ({ page }) => {
  await login(page, '/briefs');
  await page.getByLabel('Sector').selectOption('legal-ai');
  await page.getByRole('button', { name: 'Generate brief' }).click();
  await expect(page.getByRole('heading', { name: 'Legal AI: sector brief' })).toBeVisible({ timeout: 20_000 });
  const firstCitation = page.getByRole('link', { name: 'Source 1' }).first();
  await expect(firstCitation).toBeVisible();
  await expect(page.getByText(/Sources \(\d+\)/)).toBeVisible();
});

test('CSV export downloads', async ({ page }) => {
  await login(page, '/companies?sector=legal-ai');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Export CSV' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^strata-companies-.*\.csv$/);
});
