import { expect, test } from '@playwright/test';

test('login apresenta a identidade e orienta configuração ausente', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /entrar no sistema/i })).toBeVisible();
  await expect(page.getByText(/Mantiqueira/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
});

test('login continua utilizável em viewport de celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByLabel(/e-mail/i)).toBeVisible();
  await expect(page.getByLabel(/^senha\s*\*?$/i)).toBeVisible();
});
