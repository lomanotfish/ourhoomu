import { expect, test, type Page } from '@playwright/test';

// ACTUAL-LOCAL-HTTP BROWSER LANE — no mocks anywhere in this file.
// The browser renders the real app/api.tsx screen through the test-only
// harness entry, signs in through the real synthetic-issuer flow
// (challenges -> __synthetic/token -> exchange), and every subsequent call
// hits the real local API handlers on 127.0.0.1:18775. Sessions are
// memory-only inside the harness runtime; each test uses a fresh synthetic
// identity so data is isolated per test.

const api = 'http://127.0.0.1:18775';

/**
 * Bootstrap-only document rewrite: the dev server's HTML template hardcodes
 * `transform.routerRoot=app` in the entry bundle URL. This intercepts ONLY the
 * top-level document navigation and points the router root at the harness
 * routes directory, so the real dev server serves the harness route tree.
 * No API request is ever intercepted or mocked in this lane.
 */
async function serveHarnessEntry(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'document') return route.fallback();
    const template = await (await route.fetch()).text();
    const rewritten = template.replace(
      'transform.routerRoot=app',
      'transform.routerRoot=test-harness/routes',
    );
    await route.fulfill({
      response: await route.fetch(),
      body: rewritten,
      contentType: 'text/html; charset=utf-8',
    });
  });
}

async function signInViaSyntheticIssuer(page: Page): Promise<string> {
  await serveHarnessEntry(page);
  const subject = crypto.randomUUID();
  await page.goto(`/signin?subject=${subject}`);
  await page.getByRole('button', { name: 'RUN HARNESS SIGN-IN', exact: true }).click();
  await expect(page.getByText('API MODE · ไม่มี demo fallback', { exact: true })).toBeVisible();
  return subject;
}

test('actual-local-HTTP: synthetic sign-in reaches the real screen with zero houses', async ({
  page,
}) => {
  await signInViaSyntheticIssuer(page);
  await expect(page.getByText('ยังไม่มีบ้าน', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'สร้างบ้าน', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เข้าร่วมบ้าน', exact: true })).toBeVisible();
});

test('actual-local-HTTP: created house auto-enters with the owner member and honest version', async ({
  page,
}) => {
  await signInViaSyntheticIssuer(page);
  const houseName = `บ้าน HTTP ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel('ชื่อบ้านใหม่', { exact: true }).fill(houseName);
  await page.getByRole('button', { name: 'สร้างบ้าน', exact: true }).click();

  await expect(page.getByText(houseName, { exact: true })).toBeVisible();
  await expect(page.getByText('เลือกอยู่')).toBeVisible();
  await expect(page.getByText(`สมาชิก · ${houseName}`)).toBeVisible();
  await expect(page.getByText('เจ้าของบ้าน · ใช้งานอยู่ · v1')).toBeVisible();
});

test('actual-local-HTTP: invitation can be issued and revoked on a real house', async ({
  page,
}) => {
  await signInViaSyntheticIssuer(page);
  const houseName = `บ้าน HTTP ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel('ชื่อบ้านใหม่', { exact: true }).fill(houseName);
  await page.getByRole('button', { name: 'สร้างบ้าน', exact: true }).click();
  await expect(page.getByText(`สมาชิก · ${houseName}`)).toBeVisible();

  await page.getByRole('button', { name: 'สร้างคำเชิญ', exact: true }).click();
  await expect(page.getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)')).toBeVisible();

  await page.getByRole('button', { name: 'เพิกถอนคำเชิญ', exact: true }).click();
  await expect(page.getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)')).toBeHidden();
  await expect(page.getByRole('button', { name: 'สร้างคำเชิญ', exact: true })).toBeVisible();
});

test('actual-local-HTTP: own recipient account can be created and listed', async ({ page }) => {
  await signInViaSyntheticIssuer(page);
  const houseName = `บ้าน HTTP ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel('ชื่อบ้านใหม่', { exact: true }).fill(houseName);
  await page.getByRole('button', { name: 'สร้างบ้าน', exact: true }).click();
  await expect(page.getByText(`สมาชิก · ${houseName}`)).toBeVisible();

  await page.getByRole('button', { name: 'โหลดบัญชีของฉัน', exact: true }).click();
  await expect(page.getByText('ยังไม่มีบัญชีรับเงินในรายการ')).toBeVisible();

  await page.getByLabel('ชื่อบัญชี', { exact: true }).fill('บัญชี HTTP');
  await page.getByLabel('รหัสธนาคาร', { exact: true }).fill('SCB');
  await page.getByLabel('เลขบัญชี', { exact: true }).fill('1234567890');
  await page.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();

  await expect(page.getByText('บัญชี HTTP · SCB')).toBeVisible();
  await expect(page.getByText('••••7890 · บัญชีหลัก · เปิด')).toBeVisible();
});

test('actual-local-HTTP: logout clears the session and the next bootstrap is honest', async ({
  page,
}) => {
  await signInViaSyntheticIssuer(page);
  const houseName = `บ้าน HTTP ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel('ชื่อบ้านใหม่', { exact: true }).fill(houseName);
  await page.getByRole('button', { name: 'สร้างบ้าน', exact: true }).click();
  await expect(page.getByText(`สมาชิก · ${houseName}`)).toBeVisible();

  await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
  // After logout the harness lands on the index route with no stored
  // credentials: the honest no-session bootstrap error.
  await expect(page.getByText('เชื่อมต่อไม่ได้', { exact: true })).toBeVisible();
  await expect(page.getByText('No authenticated session', { exact: true })).toBeVisible();
  await expect(page.getByText(houseName, { exact: true })).toHaveCount(0);
});
