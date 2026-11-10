import { expect, type Page } from '@playwright/test';

export const ANALYST = { email: process.env.E2E_EMAIL ?? 'analyst@strata.local', password: process.env.E2E_PASSWORD ?? 'strata-demo-2026' };

export async function login(page: Page, next = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(ANALYST.email);
  await page.getByLabel('Password').fill(ANALYST.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const escaped = next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(page).toHaveURL(new RegExp(escaped));
}

export const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? 'admin@strata.local', password: process.env.E2E_PASSWORD ?? 'strata-demo-2026' };

export async function loginAs(page: Page, who: { email: string; password: string }, next = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}
