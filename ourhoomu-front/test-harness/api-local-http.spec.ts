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
    // Single fetch reused for both inspection and fulfillment.
    const response = await route.fetch();
    const template = await response.text();
    // Fail loudly when the Expo bootstrap marker is absent: without it the
    // rewrite is a silent no-op and the production app tree would be served
    // instead of the harness routes.
    if (!template.includes('transform.routerRoot=app')) {
      throw new Error(
        'Expo bootstrap marker transform.routerRoot=app is missing from the served document',
      );
    }
    const rewritten = template.replace(
      'transform.routerRoot=app',
      'transform.routerRoot=test-harness/routes',
    );
    await route.fulfill({
      response,
      body: rewritten,
      contentType: 'text/html; charset=utf-8',
    });
  });
}

/**
 * Reads the one-time invitation token rendered under the show-once label.
 * The token is a sibling of the label element in the RNW DOM; it is displayed
 * exactly once by the real screen, so the test must capture it while visible.
 */
async function readShownInvitationToken(page: Page): Promise<string> {
  const handle = await page
    .getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)', { exact: true })
    .evaluateHandle((label) => label.nextElementSibling?.textContent ?? '');
  const token = (await handle.jsonValue()) as string;
  expect(token.length).toBeGreaterThan(0);
  return token;
}

/** Signs a second, fully independent browser context in (memory-only session). */
async function openSecondSession(browser: {
  newContext(): Promise<{ newPage(): Promise<Page>; close(): Promise<void> }>;
}): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signInViaSyntheticIssuer(page);
  } catch (cause) {
    await context.close();
    throw cause;
  }
  return page;
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

  const accountsResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' && response.url().includes('/v1/me/recipient-accounts'),
  );
  await page.getByRole('button', { name: 'โหลดบัญชีของฉัน', exact: true }).click();
  expect((await accountsResponse).status()).toBe(200);

  await page.getByLabel('ชื่อบัญชี', { exact: true }).fill('บัญชี HTTP');
  await page.getByLabel('รหัสธนาคาร', { exact: true }).fill('SCB');
  await page.getByLabel('เลขบัญชี', { exact: true }).fill('1234567890');
  await page.getByRole('button', { name: 'ตั้งเป็นบัญชีหลัก', exact: true }).click();
  await page.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();

  await expect(page.getByText('บัญชี HTTP · SCB')).toBeVisible();
  await expect(page.getByText('••••7890 · บัญชีหลัก · เปิด')).toBeVisible();
});

test('actual-local-HTTP: invitation issued by one session is accepted by a separate session', async ({
  page,
  browser,
}) => {
  await signInViaSyntheticIssuer(page);
  const houseName = `บ้าน HTTP ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel('ชื่อบ้านใหม่', { exact: true }).fill(houseName);
  await page.getByRole('button', { name: 'สร้างบ้าน', exact: true }).click();
  await expect(page.getByText(`สมาชิก · ${houseName}`)).toBeVisible();

  await page.getByRole('button', { name: 'สร้างคำเชิญ', exact: true }).click();
  await expect(page.getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)')).toBeVisible();
  const token = await readShownInvitationToken(page);

  // A separate browser context is a separate memory-only session identity.
  const pageB = await openSecondSession(browser);
  await pageB.getByLabel('รหัสคำเชิญ', { exact: true }).fill(token);
  await pageB.getByRole('button', { name: 'เข้าร่วมบ้าน', exact: true }).click();
  await expect(pageB.getByText(houseName, { exact: true })).toBeVisible();
  await pageB.getByRole('button', { name: `เปิดบ้าน ${houseName}`, exact: true }).click();
  await expect(pageB.getByText(`สมาชิก · ${houseName}`)).toBeVisible();
  await expect(pageB.getByText('เจ้าของบ้าน · ใช้งานอยู่ · v1')).toBeVisible();
  await expect(pageB.getByText('สมาชิก · ใช้งานอยู่ · v1')).toBeVisible();

  // The owner sees the joined member after reloading the house detail.
  await page.getByRole('button', { name: `เปิดบ้าน ${houseName}`, exact: true }).click();
  await expect(page.getByText('สมาชิก · ใช้งานอยู่ · v1')).toBeVisible();
});

test('actual-local-HTTP: member leaves the joined house and creates an own house', async ({
  page,
  browser,
}) => {
  await signInViaSyntheticIssuer(page);
  const houseName = `บ้าน HTTP ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel('ชื่อบ้านใหม่', { exact: true }).fill(houseName);
  await page.getByRole('button', { name: 'สร้างบ้าน', exact: true }).click();
  await expect(page.getByText(`สมาชิก · ${houseName}`)).toBeVisible();

  await page.getByRole('button', { name: 'สร้างคำเชิญ', exact: true }).click();
  await expect(page.getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)')).toBeVisible();
  const token = await readShownInvitationToken(page);

  const pageB = await openSecondSession(browser);
  await pageB.getByLabel('รหัสคำเชิญ', { exact: true }).fill(token);
  await pageB.getByRole('button', { name: 'เข้าร่วมบ้าน', exact: true }).click();
  await expect(pageB.getByText(houseName, { exact: true })).toBeVisible();
  await pageB.getByRole('button', { name: `เปิดบ้าน ${houseName}`, exact: true }).click();
  await expect(pageB.getByText(`สมาชิก · ${houseName}`)).toBeVisible();

  // Leaving the only house returns the member to the honest zero-house state
  // where the real create/join forms reappear.
  await pageB.getByRole('button', { name: 'ออกจากบ้าน', exact: true }).click();
  await expect(pageB.getByText('ยังไม่มีบ้าน', { exact: true })).toBeVisible();

  const ownName = `บ้าน HTTP ${crypto.randomUUID().slice(0, 8)}`;
  await pageB.getByLabel('ชื่อบ้านใหม่', { exact: true }).fill(ownName);
  await pageB.getByRole('button', { name: 'สร้างบ้าน', exact: true }).click();
  await expect(pageB.getByText(`สมาชิก · ${ownName}`)).toBeVisible();
  await expect(pageB.getByText('เจ้าของบ้าน · ใช้งานอยู่ · v1')).toBeVisible();

  // The left member disappears from the owner's active member list.
  await page.getByRole('button', { name: `เปิดบ้าน ${houseName}`, exact: true }).click();
  await expect(page.getByText('เจ้าของบ้าน · ใช้งานอยู่ · v1')).toBeVisible();
  await expect(page.getByText('สมาชิก · ใช้งานอยู่ · v1')).toHaveCount(0);
});

test('actual-local-HTTP: revoked invitation is refused for a separate session', async ({
  page,
  browser,
}) => {
  await signInViaSyntheticIssuer(page);
  const houseName = `บ้าน HTTP ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel('ชื่อบ้านใหม่', { exact: true }).fill(houseName);
  await page.getByRole('button', { name: 'สร้างบ้าน', exact: true }).click();
  await expect(page.getByText(`สมาชิก · ${houseName}`)).toBeVisible();

  await page.getByRole('button', { name: 'สร้างคำเชิญ', exact: true }).click();
  await expect(page.getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)')).toBeVisible();
  const token = await readShownInvitationToken(page);

  await page.getByRole('button', { name: 'เพิกถอนคำเชิญ', exact: true }).click();
  await expect(page.getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)')).toBeHidden();

  const pageB = await openSecondSession(browser);
  await pageB.getByLabel('รหัสคำเชิญ', { exact: true }).fill(token);
  await pageB.getByRole('button', { name: 'เข้าร่วมบ้าน', exact: true }).click();
  // The real handler refuses revoked tokens with the opaque 409
  // invite_unavailable envelope; the joining session stays at zero houses.
  await expect(pageB.getByText('409 · invite unavailable', { exact: true })).toBeVisible();
  await expect(pageB.getByText('ยังไม่มีบ้าน', { exact: true })).toBeVisible();
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
