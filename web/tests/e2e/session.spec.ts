import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:5174';
test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:8787/__test/reset');
});
test('browser tabs share rotating cookies and revoked sessions return to login', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill('master');
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Selamat datang, Master' })).toBeVisible();
  const other = await context.newPage();
  await Promise.all([page.reload(), other.goto('/')]);
  for (const tab of [page, other])
    await expect(tab.getByRole('heading', { name: 'Selamat datang, Master' })).toBeVisible();
  await context.addCookies([
    {
      name: 'crm_access',
      value: 'expired',
      domain: '127.0.0.1',
      path: '/api',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  await Promise.all([
    page.getByRole('button', { name: 'Muat ulang', exact: true }).click(),
    other.getByRole('button', { name: 'Muat ulang', exact: true }).click(),
  ]);
  for (const tab of [page, other])
    await expect(tab.getByRole('link', { name: /SPK bulan ini/ })).toContainText('0');
  await other.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(other.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Muat ulang', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
});
