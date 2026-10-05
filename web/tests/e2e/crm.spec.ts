import { test, expect, type Page } from '@playwright/test';
const origin = 'http://127.0.0.1:5174';
const ids = {
  supervisor: '22222222-2222-4222-8222-222222222222',
  consultant: '33333333-3333-4333-8333-333333333333',
  outside: '55555555-5555-4555-8555-555555555555',
};
const day = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
async function login(page: Page, username = 'master', password = 'test-password-123') {
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /Selamat datang,|Buat password pribadi/ }),
  ).toBeVisible();
}
async function go(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
}
async function post(page: Page, route: string, data: unknown) {
  return page.request.post(`/api/${route}`, { headers: { Origin: origin }, data });
}
async function seedSpk(page: Page, number = '12345', options: Record<string, unknown> = {}) {
  const response = await post(page, 'spks', {
    consultantId: ids.consultant,
    number: `LOT - ${number}`,
    date: day,
    customerName: `Pelanggan ${number}`,
    clientType: 'retail',
    phone: '08123456789',
    carType: 'JAECOO J5 PREMIUM',
    color: 'PRISTINE WHITE',
    quantity: 1,
    payment: 'cash',
    sameAsOtr: true,
    bonus: 'Bonus standar',
    promiseFrom: day,
    promiseTo: day,
    ...options,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).spk;
}
async function patch(page: Page, spk: { id: string; revision: number }, changes: unknown) {
  const response = await page.request.patch(`/api/spks/item?id=${spk.id}`, {
    headers: { Origin: origin },
    data: { revision: spk.revision, changes },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).spk;
}
async function expandSpk(page: Page, name: string) {
  const card = page.locator('.spk-card').filter({ hasText: name });
  if ((await card.locator('.card-summary').getAttribute('aria-expanded')) !== 'true')
    await card.locator('.card-summary').click();
  return card;
}
test.beforeEach(async ({ request }) => {
  const result = await request.post('http://127.0.0.1:8787/__test/reset');
  expect(result.ok()).toBeTruthy();
});

test('login, private cookies, reload, expired access renewal, logout and mobile layout', async ({
  page,
  context,
}, info) => {
  await login(page);
  await expect(page.getByRole('link', { name: /SPK bulan ini/ })).toContainText('0');
  const cookies = await context.cookies(`${origin}/api`);
  expect(
    cookies
      .filter((c) => c.name.startsWith('crm_'))
      .every((c) => c.httpOnly && c.sameSite === 'Strict'),
  ).toBe(true);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Selamat datang, Master' })).toBeVisible();
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
  await page.getByRole('button', { name: 'Muat ulang', exact: true }).click();
  await expect(page.getByRole('link', { name: /SPK bulan ini/ })).toContainText('0');
  expect(
    (await context.cookies(`${origin}/api`)).find((c) => c.name === 'crm_access')?.value,
  ).not.toBe('expired');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Buka navigasi' }).click();
    await expect(page.getByRole('link', { name: 'Kelola akun', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tutup navigasi', exact: true }).click();
  }
  await page.screenshot({
    path: `test-results/dashboard-${info.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
  expect(
    (await context.cookies(`${origin}/api`)).filter((c) => c.name.startsWith('crm_')),
  ).toHaveLength(0);
});

test('create credit SPK, edit all form fields, allocate Noka, refund and CSI', async ({
  page,
}, info) => {
  await login(page);
  await go(page, 'spks/new');
  await page.getByLabel('Sales', { exact: true }).selectOption(ids.consultant);
  await page.getByLabel('Nomor SPK (5 angka)', { exact: true }).fill('12345');
  await page.getByLabel('Nama pelanggan', { exact: true }).fill('Pelanggan Web');
  await page.getByLabel('Nomor telepon', { exact: true }).fill('08123456789');
  await page.getByLabel('Jenis klien', { exact: true }).selectOption('fleet');
  await page.getByLabel('Jumlah', { exact: true }).fill('2');
  await page.getByLabel('Tipe mobil', { exact: true }).selectOption('JAECOO J7 SHS');
  await page.getByLabel('Warna', { exact: true }).selectOption('MOONLIGHT SILVER');
  await page.getByLabel('Noka', { exact: true }).fill('VIN-WEB-001');
  await page.getByLabel('Harga deal (Rp)', { exact: true }).fill('500000000.50');
  await page.getByLabel('Metode pembayaran', { exact: true }).selectOption('credit');
  await page.getByLabel('Tenor (bulan)', { exact: true }).fill('48');
  await page.getByLabel('TDP (Rp)', { exact: true }).fill('100000000');
  await page.getByLabel('Bonus standar', { exact: true }).uncheck();
  await page.getByLabel('Bonus dari sales atau event', { exact: true }).fill('Aksesori');
  await page.getByLabel('Deskripsi', { exact: true }).fill('Catatan pelanggan');
  await page.screenshot({
    path: `test-results/spk-form-${info.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Simpan SPK', exact: true }).click();
  let card = await expandSpk(page, 'Pelanggan Web');
  await expect(card).toContainText('VIN-WEB-001');
  await expect(card).toContainText('48 bulan');
  await expect(card).toContainText('Aksesori');
  await card.getByRole('link', { name: 'Edit SPK', exact: true }).click();
  await page.getByLabel('Nama pelanggan', { exact: true }).fill('Pelanggan Diperbarui');
  await page.getByLabel('Refund kredit cair', { exact: true }).check();
  await page.getByLabel('Insentif CSI cair', { exact: true }).check();
  await page.getByRole('button', { name: 'Simpan perubahan', exact: true }).click();
  card = await expandSpk(page, 'Pelanggan Diperbarui');
  await expect(card).toContainText('Refund kredit: Cair');
  await expect(card).toContainText('Insentif CSI: Cair');
  const response = await page.request.get(`/api/spks?month=${day.slice(0, 7)}`);
  const spk = (await response.json()).spks[0];
  expect(spk.quantity).toBe(2);
  expect(spk.payment).toBe('credit');
  expect(Number(spk.dealPrice)).toBe(500000000.5);
  expect(spk.vinAllocated).toBeTruthy();
});

test('delivery prerequisites, preserved Plan DO date, closed filter and outstanding', async ({
  page,
}) => {
  await login(page);
  await seedSpk(page);
  await go(page, 'spks');
  let card = await expandSpk(page, 'Pelanggan 12345');
  await expect(card.getByLabel('Plan DO', { exact: true })).toBeDisabled();
  await expect(card.getByLabel('Dikirim', { exact: true })).toBeDisabled();
  await card.getByLabel('CRM', { exact: true }).check();
  card = await expandSpk(page, 'Pelanggan 12345');
  await card.getByLabel('DMS', { exact: true }).check();
  card = await expandSpk(page, 'Pelanggan 12345');
  await card.getByLabel('Lunas', { exact: true }).check();
  card = await expandSpk(page, 'Pelanggan 12345');
  await card.getByLabel('Plan DO', { exact: true }).check();
  card = await expandSpk(page, 'Pelanggan 12345');
  await card.getByLabel('Tanggal Plan DO', { exact: true }).fill('2026-01-03');
  card = await expandSpk(page, 'Pelanggan 12345');
  await card.getByLabel('Dikirim', { exact: true }).check();
  card = await expandSpk(page, 'Pelanggan 12345');
  await expect(card.getByLabel('CRM', { exact: true })).toBeDisabled();
  await expect(card.getByLabel('Lunas', { exact: true })).toBeDisabled();
  await expect(card).toContainText('closed');
  await expect(card.getByLabel('Tanggal Plan DO', { exact: true })).toHaveValue('2026-01-03');
  await page.getByRole('button', { name: 'Closed', exact: true }).click();
  await expect(page.locator('.spk-card')).toHaveCount(1);
  await go(page, 'outstanding');
  await expect(page.getByRole('heading', { name: 'Belum ada SPK', exact: true })).toBeVisible();
});

test('cancellation, status filtering, old outstanding SPK and deletion', async ({ page }) => {
  await login(page);
  await seedSpk(page, '10001', { date: '2025-01-02' });
  await seedSpk(page, '10002');
  await go(page, 'outstanding');
  await expect(page.locator('.spk-card')).toHaveCount(2);
  await go(page, 'spks');
  const card = await expandSpk(page, 'Pelanggan 10002');
  await card.getByRole('button', { name: 'Batalkan SPK', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Batalkan SPK', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelled', exact: true }).click();
  await expect(page.locator('.spk-card')).toHaveCount(1);
  const cancelled = await expandSpk(page, 'Pelanggan 10002');
  await cancelled.getByRole('button', { name: 'Hapus SPK', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hapus', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Belum ada SPK', exact: true })).toBeVisible();
});

test('SPK conflict blocks overwrite until the latest revision is loaded', async ({ page }) => {
  await login(page);
  const spk = await seedSpk(page);
  await go(page, `spks/edit/${spk.id}`);
  await expect(page.getByLabel('Nama pelanggan', { exact: true })).toHaveValue('Pelanggan 12345');
  await patch(page, spk, { customerName: 'Diubah Android' });
  await page.getByLabel('Nama pelanggan', { exact: true }).fill('Diubah Web');
  await page.getByRole('button', { name: 'Simpan perubahan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Simpan perubahan', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Muat SPK terbaru', exact: true }).click();
  await expect(page.getByLabel('Nama pelanggan', { exact: true })).toHaveValue('Diubah Android');
  await page.getByLabel('Nama pelanggan', { exact: true }).fill('Perubahan aman');
  await page.getByRole('button', { name: 'Simpan perubahan', exact: true }).click();
  await expect(page.locator('.spk-card')).toContainText('Perubahan aman');
});

test('prospect creation, follow-up history, sales filter and read-only completed archive', async ({
  page,
}) => {
  await login(page);
  await go(page, 'prospects');
  await page.getByRole('button', { name: 'Tambah prospek', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Sales', { exact: true }).selectOption(ids.consultant);
  await dialog.getByLabel('Nama pelanggan', { exact: true }).fill('Prospek Web');
  await dialog.getByLabel('Mau apa', { exact: true }).fill('Test drive J5');
  await dialog.getByLabel('Tahap', { exact: true }).fill('Kontak awal');
  await dialog.getByRole('button', { name: 'Simpan prospek', exact: true }).click();
  let card = page.locator('.prospect-card').filter({ hasText: 'Prospek Web' });
  await card.locator('.card-summary').click();
  await expect(card.locator('.timeline')).toContainText('Kontak awal');
  await card.getByLabel('Mau apa berikutnya', { exact: true }).fill('Minta penawaran');
  await card.getByLabel('Tahap berikutnya', { exact: true }).fill('Negosiasi');
  await card.getByRole('button', { name: 'Simpan tindak lanjut', exact: true }).click();
  card = page.locator('.prospect-card').filter({ hasText: 'Prospek Web' });
  await expect(card.locator('.timeline li')).toHaveCount(2);
  await expect(card.locator('.timeline')).toContainText('Negosiasi');
  await card.getByRole('button', { name: 'Berhasil', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Selesaikan prospek', exact: true })
    .click();
  await page.getByRole('button', { name: 'Prospek selesai', exact: true }).click();
  await page.getByLabel('Filter sales', { exact: true }).selectOption(ids.consultant);
  card = page.locator('.prospect-card').filter({ hasText: 'Prospek Web' });
  await card.locator('.card-summary').click();
  await expect(card).toContainText('Berhasil · Arsip');
  await expect(card.locator('.timeline li')).toHaveCount(2);
  await expect(card.getByRole('button', { name: 'Simpan tindak lanjut', exact: true })).toHaveCount(
    0,
  );
  const archived = (await (await page.request.get(`/api/prospects?status=completed`)).json())
    .prospects[0];
  const editArchive = await page.request.patch(`/api/prospects/item?id=${archived.id}`, {
    headers: { Origin: origin },
    data: { stage: 'Changed archive' },
  });
  expect(editArchive.status()).toBe(409);
});

test('accounts: create roles, toggle access, reset password and retain records after deletion', async ({
  page,
}) => {
  await login(page);
  const spk = await seedSpk(page);
  await go(page, 'accounts');
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nama', { exact: true }).fill('Supervisor Baru');
  await dialog.getByLabel('Username', { exact: true }).fill('new-supervisor');
  await dialog.getByLabel('Peran', { exact: true }).selectOption('supervisor');
  await dialog.getByLabel('Password sementara', { exact: true }).fill('temporary-password-123');
  await dialog.getByRole('button', { name: 'Simpan akun', exact: true }).click();
  await expect(page.locator('.account-row').filter({ hasText: 'Supervisor Baru' })).toBeVisible();
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nama', { exact: true }).fill('Consultant Baru');
  await dialog.getByLabel('Username', { exact: true }).fill('new-consultant');
  await dialog.getByLabel('Supervisor', { exact: true }).selectOption({ label: 'Supervisor Baru' });
  await dialog.getByLabel('Password sementara', { exact: true }).fill('temporary-password-123');
  await dialog.getByRole('button', { name: 'Simpan akun', exact: true }).click();
  await expect(page.locator('.account-row').filter({ hasText: 'Consultant Baru' })).toBeVisible();
  const consultant = page
    .locator('.account-row')
    .filter({ has: page.getByText('Consultant Test', { exact: true }) });
  await consultant.getByRole('button', { name: 'Nonaktifkan', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Nonaktifkan', exact: true }).click();
  await expect(consultant).toContainText('Nonaktif');
  await consultant.getByRole('button', { name: 'Aktifkan', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Aktifkan', exact: true }).click();
  await expect(consultant).toContainText('Aktif');
  await consultant.getByRole('button', { name: 'Reset password', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Password sementara', { exact: true }).fill('replacement-password-123');
  await dialog.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(consultant).toContainText('Menunggu perubahan password');
  await consultant.getByRole('button', { name: 'Hapus akun Consultant Test', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hapus akun', exact: true }).click();
  await expect(consultant).toHaveCount(0);
  const response = await page.request.get(`/api/spks/item?id=${spk.id}`);
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).spk.consultantName).toBe('Consultant Test');
});

test('first login forces password change and invalid current password stays recoverable', async ({
  page,
}) => {
  await login(page);
  expect(
    (
      await post(page, 'users', {
        username: 'fresh',
        displayName: 'Fresh User',
        role: 'consultant',
        supervisorId: ids.supervisor,
        password: 'temporary-password-123',
      })
    ).ok(),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await login(page, 'fresh', 'temporary-password-123');
  await expect(
    page.getByRole('heading', { name: 'Buat password pribadi', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'SPK', exact: true })).toHaveCount(0);
  await page.getByLabel('Password sementara', { exact: true }).fill('wrong-password');
  await page.getByLabel('Password baru', { exact: true }).fill('my-new-password-123');
  await page.getByLabel('Konfirmasi password baru', { exact: true }).fill('my-new-password-123');
  await page.getByRole('button', { name: 'Simpan password', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Current password is incorrect');
  await page.getByLabel('Password sementara', { exact: true }).fill('temporary-password-123');
  await page.getByRole('button', { name: 'Simpan password', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
  await login(page, 'fresh', 'my-new-password-123');
  await expect(page.getByRole('heading', { name: 'Selamat datang, Fresh' })).toBeVisible();
});

test('supervisor and consultant permissions are enforced by API and navigation', async ({
  page,
}) => {
  await login(page);
  const own = await seedSpk(page);
  const other = await seedSpk(page, '54321', { consultantId: ids.outside });
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await login(page, 'supervisor');
  await go(page, 'spks');
  await expect(page.locator('.spk-card')).toHaveCount(1);
  expect((await page.request.get(`/api/spks/item?id=${other.id}`)).status()).toBe(404);
  expect((await post(page, 'users', { username: 'forbidden' })).status()).toBe(403);
  await go(page, 'sales');
  await expect(page.getByRole('heading', { name: 'Consultant Test', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Other Consultant', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await login(page, 'consultant');
  await go(page, 'spks');
  const card = await expandSpk(page, 'Pelanggan 12345');
  await expect(card.getByLabel('Lunas', { exact: true })).toBeDisabled();
  await expect(card.getByRole('button', { name: 'Hapus SPK', exact: true })).toHaveCount(0);
  expect(
    (
      await page.request.patch(`/api/spks/item?id=${own.id}`, {
        headers: { Origin: origin },
        data: { revision: own.revision, changes: { fullyPaid: true } },
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.get('/api/users')).status()).toBe(403);
  await go(page, 'accounts');
  await expect(page.getByRole('heading', { name: 'Selamat datang, Consultant' })).toBeVisible();
});

test('pagination covers all 26 records and month/status changes reset the page', async ({
  page,
}) => {
  await login(page);
  for (let i = 0; i < 26; i++) await seedSpk(page, String(10000 + i));
  await go(page, 'spks');
  await expect(page.locator('.spk-card')).toHaveCount(25);
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await expect(page.locator('.spk-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('.spk-card')).toHaveCount(25);
  await page.getByRole('button', { name: 'Bulan lalu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Belum ada SPK', exact: true })).toBeVisible();
});

test('network failure offers retry, failed login and CSRF rejection do not authenticate', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill('master');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid username or password');
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Selamat datang, Master' })).toBeVisible();
  await page.route('**/api/spks?*', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: '{"error":"Test koneksi terputus"}',
    }),
  );
  await go(page, 'spks');
  await expect(page.getByRole('alert')).toContainText('Test koneksi terputus');
  await page.unroute('**/api/spks?*');
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Belum ada SPK', exact: true })).toBeVisible();
  expect(
    (
      await page.request.post('/api/auth/login', {
        headers: { Origin: 'https://evil.example' },
        data: { username: 'master', password: 'test-password-123' },
      })
    ).status(),
  ).toBe(403);
});
