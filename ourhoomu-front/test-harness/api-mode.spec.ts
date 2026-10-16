import { expect, test } from '@playwright/test';

const fixtureBase = 'http://127.0.0.1:18058';
const unauthorized = {
  error: { code: 'unauthenticated', message: 'Session required' },
  requestId: '11111111-1111-4111-8111-111111111111',
};

test('API-mode signed-out screen uses actual screen/runtime and never falls back to demo', async ({
  page,
}) => {
  let meCalls = 0;
  await page.route(`${fixtureBase}/v1/me`, async (route) => {
    meCalls++;
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(unauthorized) });
  });

  await page.goto('/api');
  await expect(page.getByText('API MODE · ไม่มี demo fallback', { exact: true })).toBeVisible();
  await expect(page.getByText('No authenticated session', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ลองใหม่', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ลองบ้านตัวอย่าง', exact: true })).toHaveCount(0);
  expect(meCalls).toBe(0);
});

test('API-mode missing credentials remain signed out without pretending to retry the API', async ({ page }) => {
  let meCalls = 0;
  await page.route(`${fixtureBase}/v1/me`, async (route) => {
    meCalls++;
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(unauthorized) });
  });
  await page.goto('/api');
  await expect(page.getByText('เชื่อมต่อไม่ได้', { exact: true })).toBeVisible();
  await expect(page.getByText('No authenticated session', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
  await expect(page.getByText('No authenticated session', { exact: true })).toBeVisible();
  await expect(page.getByText('API MODE · ไม่มี demo fallback', { exact: true })).toBeVisible();
  expect(meCalls).toBe(0);
});
