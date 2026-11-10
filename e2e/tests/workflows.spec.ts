import { expect, test } from '@playwright/test';
import { ADMIN, ANALYST, loginAs } from './helpers';

test('analyst records a cited funding round and receives an alert for it', async ({ page }) => {
  await loginAs(page, ANALYST, '/companies/darrow');
  await page.getByRole('button', { name: 'Add round' }).click();
  const day = `2026-0${1 + Math.floor(Math.random() * 9)}-1${Math.floor(Math.random() * 9)}`;
  await page.getByLabel('Date').fill(day);
  await page.getByLabel('Round type').selectOption('series_b');
  await page.getByLabel(/Amount/).fill('37.5');
  await page.getByLabel(/Investors/).fill('E2E Ventures');
  await page.getByLabel(/Source URL/).fill(`https://example.com/darrow-e2e-${day}`);
  await page.getByLabel('Source title').fill('Darrow raises Series B (e2e)');
  await page.getByLabel(/Evidence excerpt/).fill('Darrow raised $37.5 million in a Series B round led by E2E Ventures.');
  await page.getByRole('button', { name: 'Save round' }).click();
  await expect(page.getByText('$37.5M').first()).toBeVisible();
  await expect(page.getByText('Investors: E2E Ventures').first()).toBeVisible();

  // funding.created → alerts job → the analyst's "Legal AI" watchlist alerts.
  await page.goto('/alerts');
  await expect(page.getByRole('link', { name: 'Darrow: $37.5M Series B' }).first()).toBeVisible({ timeout: 20_000 });
});

test('analyst creates, edits and deletes a watchlist; private webhooks are refused', async ({ page }) => {
  await loginAs(page, ANALYST, '/watchlists');
  await page.getByRole('button', { name: 'New watchlist' }).click();
  await page.getByLabel('Name').fill('E2E list');
  await page.getByRole('button', { name: 'Climate Tech', exact: true }).click();
  await page.getByLabel(/Webhook URL/).fill('https://127.0.0.1/hook');
  await page.getByRole('button', { name: 'Create watchlist' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /private or reserved|rejected/ })).toBeVisible();
  await page.getByLabel(/Webhook URL/).fill('');
  await page.getByRole('button', { name: 'Create watchlist' }).click();
  await expect(page.getByRole('heading', { name: 'E2E list' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit E2E list' }).click();
  await page.getByLabel('Name').fill('E2E list (renamed)');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'E2E list (renamed)' })).toBeVisible();

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete E2E list (renamed)' }).click();
  await expect(page.getByRole('heading', { name: 'E2E list (renamed)' })).toHaveCount(0);
});

test('admin console shows system status and validates connector input', async ({ page }) => {
  await loginAs(page, ADMIN, '/admin');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByText('Event bus')).toBeVisible();
  await expect(page.getByText('Users & roles')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Role for admin@strata.local' })).toBeDisabled();
  await page.getByLabel('Connector').selectOption('rss');
  await page.getByLabel('Feed URL').fill('https://feeds.example.invalid/feed.xml');
  await page.getByRole('button', { name: 'Run connector' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Queued' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'RSS / press feed' }).first()).toBeVisible({ timeout: 20_000 });
});

test('analysts cannot see the admin console', async ({ page }) => {
  await loginAs(page, ANALYST, '/admin');
  await expect(page.getByText('Admins only')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' })).toHaveCount(0);
});

test('funding feed paginates', async ({ page }) => {
  await loginAs(page, ANALYST, '/funding');
  await expect(page.getByText(/rounds · page 1 of \d+/)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/page 2 of/)).toBeVisible();
});

test('marks a company as notable', async ({ page }) => {
  await loginAs(page, ANALYST, '/companies/kodex');
  const toggle = page.getByRole('button', { name: /notable/i });
  const wasOn = (await toggle.getAttribute('aria-pressed')) === 'true';
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', String(!wasOn));
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', String(wasOn));
});
