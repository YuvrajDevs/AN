import { expect, type Page } from '@playwright/test';

export const ANALYST = { email: process.env.E2E_EMAIL ?? 'analyst@strata.local', password: process.env.E2E_PASSWORD ?? 'strata-demo-2026' };

export async function login(page: Page, next = '/') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(ANALYST.email);
  await page.getByLabel('Password').fill(ANALYST.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const escaped = next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(page).toHaveURL(new RegExp(next === '/' ? '/$' : escaped));
}
