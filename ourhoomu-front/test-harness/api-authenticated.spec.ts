import { expect, test, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// SW-0009 test-only browser harness: authenticated flows against the ACTUAL
// `ApiModeScreen` through the test-only Expo Router entrypoint
// (`test-harness/entry.tsx` + `test-harness/routes/`), which injects the real
// production client/session/house repository composition with a memory
// credential store pre-seeded by a synthetic fixture session.
//
// Every HTTP response below is a clearly labelled Playwright route FIXTURE on
// the dedicated synthetic origin 127.0.0.1:18058. No API/Workers process, no
// database, no identity provider and no production endpoint is contacted.
// These fixtures model the accepted frozen DTOs; they are not real-API
// evidence and do not close SW-0009/AC1a/AC2.
// ---------------------------------------------------------------------------

const fixtureBase = 'http://127.0.0.1:18058';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const FIXTURE_BEARER = 'Bearer harness-fixture-access-token';
const USER_ID = '550e8400-e29b-41d4-a716-446655440001';

type HouseFixture = { id: string; name: string; timezone: string; version: number };
type MemberFixture = {
  id: string;
  displayName: string;
  role: 'owner' | 'member';
  active: boolean;
  version: number;
};
type AccountFixture = {
  id: string;
  version: number;
  bankCode: string;
  label: string;
  maskedAccount: string;
  isDefault: boolean;
  active: boolean;
};
type InvitationFixture = {
  id: string;
  expiresAt: string;
  houseId: string;
  status: 'active' | 'revoked' | 'consumed' | 'expired';
  createdAt?: string;
  token?: string;
};

type FixtureState = {
  me: { id: string; displayName: string; houses: HouseFixture[] };
  houses: HouseFixture[];
  members: Record<string, MemberFixture[]>;
  accounts: AccountFixture[];
  /** Seed own recipient accounts without touching houses. */
  seedAccounts?: AccountFixture[];
  /** Force POST /v1/auth/refresh to answer with this HTTP status. */
  refreshStatus?: number;
  /** Delay the /v1/me answer by this many milliseconds. */
  meDelay?: number;
  /** Delay the GET /v1/houses answer by this many milliseconds. */
  housesDelay?: number;
  /** Delay house detail answers by house id, in milliseconds. */
  detailDelay?: Record<string, number>;
  /** Delay the POST /v1/auth/logout answer by this many milliseconds. */
  logoutDelay?: number;
  /** Force POST /v1/houses/:id/invitations to answer with this HTTP status. */
  issueInvitationStatus?: number;
  /** Force DELETE /v1/houses/:id/invitations/:id to answer with this HTTP status. */
  revokeInvitationStatus?: number;
  /** Force /v1/me to answer with this HTTP status (fixture error injection). */
  meStatus?: number;
  /** Force GET /v1/houses to answer with this HTTP status. */
  housesStatus?: number;
  /** Force GET /v1/houses/:id to answer with this HTTP status, per house. */
  detailStatus?: Record<string, number>;
};

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});
const envelope = (data: unknown) => ({ data, requestId: REQUEST_ID });
const listEnvelope = (data: unknown[]) => ({ data, nextCursor: null, requestId: REQUEST_ID });
const errorEnvelope = (code: string, message: string) => ({
  error: { code, message },
  requestId: REQUEST_ID,
});

const HOUSE_A: HouseFixture = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'บ้านมิว',
  timezone: 'Asia/Bangkok',
  version: 1,
};
const HOUSE_B: HouseFixture = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  name: 'บ้านเต่า',
  timezone: 'Asia/Bangkok',
  version: 3,
};

function ownerMember(displayName: string, houseId: string): MemberFixture {
  return {
    id: `550e8400-e29b-41d4-a716-4466${houseId.slice(-6)}`,
    displayName,
    role: 'owner',
    active: true,
    version: 1,
  };
}

function freshState(overrides: Partial<FixtureState> = {}): FixtureState {
  const state: FixtureState = {
    me: { id: USER_ID, displayName: 'มิว', houses: [] },
    houses: [],
    members: {},
    accounts: [],
    ...overrides,
  };
  if (state.seedAccounts) state.accounts = state.seedAccounts;
  for (const house of state.houses) {
    state.members[house.id] = [ownerMember(state.me.displayName, house.id)];
  }
  return state;
}

/**
 * Serves the harness document: fetches the Expo dev server's own HTML template,
 * rewrites the entry bundle from the production `expo-router/entry` to the
 * test-only `test-harness/entry` development bundle (dev=true), and fulfills
 * with a minimal SPA shell. The production entrypoint and app source are not
 * modified.
 */
async function serveHarnessDocument(page: Page): Promise<void> {
  await page.route('**/harness', async (route) => {
    const template = await (await route.fetch()).text();
    const match = template.match(/src="([^"]*expo-router\/entry\.bundle[^"]*)"/);
    if (!match) throw new Error('Expo entry bundle URL not found in the served HTML template');
    const harnessSrc = match[1].replace(
      'node_modules/expo-router/entry.bundle',
      'test-harness/entry.bundle',
    );
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body:
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />' +
        '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />' +
        '<style>#root,body,html{height:100%}body{overflow:hidden}#root{display:flex}</style>' +
        `</head><body><div id="root"></div><script src="${harnessSrc}" defer></script></body></html>`,
    });
  });
}

/**
 * Installs the synthetic fixture API on the dedicated fixture origin. Returns
 * a live violation list; every test asserts it stays empty, which proves the
 * real client/session composition sent the fixture bearer and idempotency
 * keys, and that no unexpected endpoint was contacted.
 */
async function installFixtureApi(page: Page, state: FixtureState): Promise<string[]> {
  const violations: string[] = [];
  // Bearer tokens the fixture accepts. A successful refresh rotates the access
  // token, and later requests must carry the rotated value.
  const accessTokens = ['harness-fixture-access-token'];
  await page.route(`${fixtureBase}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const auth = request.headers()['authorization'];
    const idempotencyKey = request.headers()['idempotency-key'];

    // The refresh endpoint intentionally carries no bearer: it authenticates
    // with the refresh token in the body. Handle it before the bearer check.
    if (path === '/v1/auth/refresh' && method === 'POST') {
      if (state.refreshStatus !== undefined) {
        await route.fulfill(
          json(state.refreshStatus, errorEnvelope('unauthenticated', 'Fixture refresh failure')),
        );
        return;
      }
      const body = request.postDataJSON() as { refreshToken?: string };
      if (body.refreshToken !== 'harness-fixture-refresh-token') {
        await route.fulfill(
          json(401, errorEnvelope('invalid_refresh_token', 'Unknown fixture refresh token')),
        );
        return;
      }
      const rotated = `harness-fixture-rotated-${Date.now()}`;
      accessTokens.push(rotated);
      await route.fulfill(
        json(
          200,
          envelope({
            accessToken: rotated,
            refreshToken: 'harness-fixture-refresh-token',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            userId: USER_ID,
          }),
        ),
      );
      return;
    }
    if (!auth || !accessTokens.includes(auth.replace(/^Bearer /, ''))) {
      violations.push(`${method} ${path} without the fixture bearer`);
      await route.fulfill(json(500, errorEnvelope('internal_error', 'Fixture bearer missing')));
      return;
    }
    if (method !== 'GET' && !idempotencyKey) {
      violations.push(`${method} ${path} without an Idempotency-Key`);
      await route.fulfill(
        json(500, errorEnvelope('internal_error', 'Fixture idempotency missing')),
      );
      return;
    }

    if (path === '/v1/me' && method === 'GET') {
      if (state.meDelay) await new Promise((resolve) => setTimeout(resolve, state.meDelay));
      if (state.meStatus !== undefined) {
        await route.fulfill(
          json(state.meStatus, errorEnvelope('unauthenticated', 'Session required')),
        );
        return;
      }
      await route.fulfill(json(200, envelope(state.me)));
      return;
    }
    if (path === '/v1/houses' && method === 'GET') {
      if (state.housesDelay) await new Promise((resolve) => setTimeout(resolve, state.housesDelay));
      if (state.housesStatus !== undefined) {
        await route.fulfill(
          json(state.housesStatus, errorEnvelope('internal_error', 'Fixture houses failure')),
        );
        return;
      }
      await route.fulfill(json(200, listEnvelope(state.houses)));
      return;
    }
    if (path === '/v1/houses' && method === 'POST') {
      const body = request.postDataJSON() as { name?: string; timezone?: string };
      const created: HouseFixture = {
        id: '550e8400-e29b-41d4-a716-446655440009',
        name: body.name ?? 'บ้านใหม่',
        timezone: body.timezone ?? 'Asia/Bangkok',
        version: 1,
      };
      state.houses.push(created);
      state.members[created.id] = [ownerMember(state.me.displayName, created.id)];
      await route.fulfill(json(200, envelope(created)));
      return;
    }
    const detailMatch = path.match(/^\/v1\/houses\/([0-9a-f-]{36})$/);
    if (detailMatch && method === 'GET') {
      const delay = state.detailDelay?.[detailMatch[1]!];
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const forced = state.detailStatus?.[detailMatch[1]!];
      if (forced !== undefined) {
        await route.fulfill(json(forced, errorEnvelope('forbidden', 'Fixture detail denial')));
        return;
      }
      const house = state.houses.find((candidate) => candidate.id === detailMatch[1]);
      if (!house) {
        await route.fulfill(json(404, errorEnvelope('not_found', 'Unknown fixture house')));
        return;
      }
      await route.fulfill(json(200, envelope(house)));
      return;
    }
    const membersMatch = path.match(/^\/v1\/houses\/([0-9a-f-]{36})\/members$/);
    if (membersMatch && method === 'GET') {
      await route.fulfill(json(200, listEnvelope(state.members[membersMatch[1]!] ?? [])));
      return;
    }
    const inviteMatch = path.match(/^\/v1\/houses\/([0-9a-f-]{36})\/invitations$/);
    if (inviteMatch && method === 'POST') {
      if (state.issueInvitationStatus !== undefined) {
        await route.fulfill(
          json(
            state.issueInvitationStatus,
            errorEnvelope('forbidden', 'Fixture invitation denial'),
          ),
        );
        return;
      }
      const issued: InvitationFixture = {
        id: '550e8400-e29b-41d4-a716-446655440008',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        houseId: inviteMatch[1]!,
        status: 'active',
        token: 'harness-fixture-invitation-token',
      };
      await route.fulfill(json(200, envelope(issued)));
      return;
    }
    const revokeMatch = path.match(/^\/v1\/houses\/([0-9a-f-]{36})\/invitations\/([0-9a-f-]{36})$/);
    if (revokeMatch && method === 'DELETE') {
      if (state.revokeInvitationStatus !== undefined) {
        await route.fulfill(
          json(
            state.revokeInvitationStatus,
            errorEnvelope('forbidden', 'Fixture invitation denial'),
          ),
        );
        return;
      }
      const revoked: InvitationFixture = {
        id: revokeMatch[2]!,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        houseId: revokeMatch[1]!,
        status: 'revoked',
        createdAt: new Date().toISOString(),
      };
      await route.fulfill(json(200, envelope(revoked)));
      return;
    }
    if (path === '/v1/me/recipient-accounts' && method === 'GET') {
      await route.fulfill(json(200, listEnvelope(state.accounts)));
      return;
    }
    if (path === '/v1/me/recipient-accounts' && method === 'POST') {
      const body = request.postDataJSON() as {
        label?: string;
        bankCode?: string;
        isDefault?: boolean;
      };
      const created: AccountFixture = {
        id: '550e8400-e29b-41d4-a716-446655440007',
        version: 1,
        bankCode: body.bankCode ?? 'SCB',
        label: body.label ?? 'บัญชีหลัก',
        maskedAccount: '••••7890',
        isDefault: body.isDefault ?? false,
        active: true,
      };
      state.accounts.push(created);
      await route.fulfill(json(200, envelope(created)));
      return;
    }
    if (path === '/v1/auth/logout' && method === 'POST') {
      if (state.logoutDelay) await new Promise((resolve) => setTimeout(resolve, state.logoutDelay));
      await route.fulfill(json(200, envelope(state.me)));
      return;
    }

    violations.push(`Unexpected fixture call ${method} ${path}`);
    await route.fulfill(json(404, errorEnvelope('not_found', 'No fixture for this request')));
  });
  return violations;
}

async function openHarness(
  page: Page,
  options: {
    houses?: HouseFixture[];
    meStatus?: number;
    housesStatus?: number;
    detailStatus?: Record<string, number>;
    seedAccounts?: AccountFixture[];
    refreshStatus?: number;
    meDelay?: number;
    housesDelay?: number;
    detailDelay?: Record<string, number>;
    logoutDelay?: number;
    issueInvitationStatus?: number;
    revokeInvitationStatus?: number;
  } = {},
): Promise<string[]> {
  await serveHarnessDocument(page);
  const state = freshState({
    houses: options.houses ?? [],
    meStatus: options.meStatus,
    housesStatus: options.housesStatus,
    detailStatus: options.detailStatus,
    seedAccounts: options.seedAccounts,
    refreshStatus: options.refreshStatus,
    meDelay: options.meDelay,
    housesDelay: options.housesDelay,
    detailDelay: options.detailDelay,
    logoutDelay: options.logoutDelay,
    issueInvitationStatus: options.issueInvitationStatus,
    revokeInvitationStatus: options.revokeInvitationStatus,
  });
  const violations = await installFixtureApi(page, state);
  await page.goto('/harness');
  return violations;
}

test('API harness zero houses: actual screen shows create/join and a created house auto-enters', async ({
  page,
}) => {
  const violations = await openHarness(page);
  await expect(page.getByText('API MODE · ไม่มี demo fallback', { exact: true })).toBeVisible();
  await expect(page.getByText('บัญชี มิว', { exact: true })).toBeVisible();
  await expect(page.getByText('ยังไม่มีบ้าน', { exact: true })).toBeVisible();

  await page.getByLabel('ชื่อบ้านใหม่', { exact: true }).fill('บ้านใหม่ของเรา');
  await page.getByRole('button', { name: 'สร้างบ้าน', exact: true }).click();

  await expect(page.getByText('บ้านใหม่ของเรา', { exact: true })).toBeVisible();
  await expect(page.getByText('เลือกอยู่')).toBeVisible();
  await expect(page.getByText('สมาชิก · บ้านใหม่ของเรา')).toBeVisible();
  await expect(page.getByText('มิว', { exact: true })).toBeVisible();
  await expect(page.getByText('เจ้าของบ้าน · ใช้งานอยู่ · v1')).toBeVisible();
  expect(violations).toEqual([]);
});

test('API harness one house: actual screen auto-enters, loads members and can issue plus revoke an invitation', async ({
  page,
}) => {
  const violations = await openHarness(page, { houses: [HOUSE_A] });
  await expect(page.getByText('บ้านมิว', { exact: true })).toBeVisible();
  await expect(page.getByText('เลือกอยู่')).toBeVisible();
  // Auto-enter lists the house but member detail loads on selection, matching
  // the actual screen behavior; open the house to load its members.
  await page.getByRole('button', { name: 'เปิดบ้าน บ้านมิว', exact: true }).click();
  await expect(page.getByText('สมาชิก · บ้านมิว')).toBeVisible();
  await expect(page.getByText('เจ้าของบ้าน · ใช้งานอยู่ · v1')).toBeVisible();

  await page.getByRole('button', { name: 'สร้างคำเชิญ', exact: true }).click();
  await expect(page.getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)')).toBeVisible();
  await expect(page.getByText('harness-fixture-invitation-token', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'เพิกถอนคำเชิญ', exact: true }).click();
  await expect(page.getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)')).toBeHidden();
  await expect(page.getByRole('button', { name: 'สร้างคำเชิญ', exact: true })).toBeVisible();
  expect(violations).toEqual([]);
});

test('API harness many houses: actual screen lists both houses and selects on tap', async ({
  page,
}) => {
  const violations = await openHarness(page, { houses: [HOUSE_A, HOUSE_B] });
  await expect(page.getByText('บ้านมิว', { exact: true })).toBeVisible();
  await expect(page.getByText('บ้านเต่า', { exact: true })).toBeVisible();
  await expect(page.getByText('เลือกอยู่')).toHaveCount(0);
  await expect(page.getByText('สมาชิก · บ้านมิว')).toHaveCount(0);

  await page.getByRole('button', { name: 'เปิดบ้าน บ้านเต่า', exact: true }).click();
  await expect(page.getByText('สมาชิก · บ้านเต่า')).toBeVisible();
  await expect(page.getByText('เลือกอยู่')).toBeVisible();
  expect(violations).toEqual([]);
});

test('API harness accounts: actual screen lists and creates own recipient accounts only', async ({
  page,
}) => {
  const violations = await openHarness(page, {
    houses: [HOUSE_A],
    seedAccounts: [
      {
        id: '550e8400-e29b-41d4-a716-446655440006',
        version: 2,
        bankCode: 'SCB',
        label: 'บัญชีหลัก',
        maskedAccount: '••••7890',
        isDefault: true,
        active: true,
      },
    ],
  });
  await expect(page.getByText('สมาชิก · บ้านมิว')).toBeVisible();

  await page.getByRole('button', { name: 'โหลดบัญชีของฉัน', exact: true }).click();
  await expect(page.getByText('บัญชีหลัก · SCB')).toBeVisible();
  await expect(page.getByText('••••7890 · บัญชีหลัก · เปิด')).toBeVisible();

  await page.getByLabel('ชื่อบัญชี', { exact: true }).fill('บัญชีสำรอง');
  await page.getByLabel('รหัสธนาคาร', { exact: true }).fill('KTB');
  await page.getByLabel('เลขบัญชี', { exact: true }).fill('1234567890');
  await page.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();

  await expect(page.getByText('บัญชีสำรอง · KTB')).toBeVisible();
  expect(violations).toEqual([]);
});

test('API harness logout: actual screen calls logout with the fixture bearer and returns to the honest signed-out state', async ({
  page,
}) => {
  const violations = await openHarness(page, { houses: [HOUSE_A] });
  await expect(page.getByText('สมาชิก · บ้านมิว')).toBeVisible();

  await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();

  await expect(page.getByText('เชื่อมต่อไม่ได้', { exact: true })).toBeVisible();
  await expect(page.getByText('No authenticated session', { exact: true })).toBeVisible();
  await expect(page.getByText('สมาชิก · บ้านมิว')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ลองใหม่', exact: true })).toBeVisible();
  expect(violations).toEqual([]);
});

test('API harness invalid states: 401 me signs out, 500 houses shows an error, 403 detail clears the house', async ({
  page,
}) => {
  // 401 on /v1/me with a stored fixture session must sign out honestly: the
  // refresh attempt also fails, so the local session is cleared.
  let violations = await openHarness(page, {
    houses: [HOUSE_A],
    meStatus: 401,
    refreshStatus: 401,
  });
  await expect(page.getByText('ยังไม่ได้เข้าสู่ระบบ', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Google/Apple ยังไม่พร้อมใช้งาน จึงไม่มี session ปลอม'),
  ).toBeVisible();
  expect(violations).toEqual([]);

  // 500 on the house list must show the honest error state.
  violations = await openHarness(page, { houses: [HOUSE_A], housesStatus: 500 });
  await expect(page.getByText('เชื่อมต่อไม่ได้', { exact: true })).toBeVisible();
  await expect(page.getByText('500 · Fixture houses failure')).toBeVisible();
  expect(violations).toEqual([]);

  // 403 on the house detail must clear the active house and show the error.
  // Detail loads on selection, so open the house to trigger the fetch.
  violations = await openHarness(page, {
    houses: [HOUSE_A],
    detailStatus: { [HOUSE_A.id]: 403 },
  });
  await page.getByRole('button', { name: 'เปิดบ้าน บ้านมิว', exact: true }).click();
  await expect(page.getByText('403 · Fixture detail denial')).toBeVisible();
  await expect(page.getByText('สมาชิก · บ้านมิว')).toHaveCount(0);
  await expect(page.getByText('บ้านมิว', { exact: true })).toBeVisible();
  expect(violations).toEqual([]);
});

test('API harness invitation privilege denial: 403 issue and revoke clear the house and show the error', async ({
  page,
}) => {
  // A denied invitation ISSUE must clear the active house and show the honest
  // error instead of leaving the member inside a house they cannot manage.
  let violations = await openHarness(page, {
    houses: [HOUSE_A],
    issueInvitationStatus: 403,
  });
  await page.getByRole('button', { name: 'เปิดบ้าน บ้านมิว', exact: true }).click();
  await expect(page.getByText('สมาชิก · บ้านมิว')).toBeVisible();
  await page.getByRole('button', { name: 'สร้างคำเชิญ', exact: true }).click();
  await expect(page.getByText('403 · Fixture invitation denial')).toBeVisible();
  await expect(page.getByText('สมาชิก · บ้านมิว')).toHaveCount(0);
  await expect(page.getByText('เลือกอยู่')).toHaveCount(0);
  await expect(page.getByText('บ้านมิว', { exact: true })).toBeVisible();
  expect(violations).toEqual([]);

  // A denied invitation REVOKE must behave the same: house cleared, error
  // shown, and the one-time invitation link removed from the screen.
  violations = await openHarness(page, {
    houses: [HOUSE_A],
    revokeInvitationStatus: 403,
  });
  await page.getByRole('button', { name: 'เปิดบ้าน บ้านมิว', exact: true }).click();
  await expect(page.getByText('สมาชิก · บ้านมิว')).toBeVisible();
  await page.getByRole('button', { name: 'สร้างคำเชิญ', exact: true }).click();
  await expect(page.getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)')).toBeVisible();
  await page.getByRole('button', { name: 'เพิกถอนคำเชิญ', exact: true }).click();
  await expect(page.getByText('403 · Fixture invitation denial')).toBeVisible();
  await expect(page.getByText('ลิงก์คำเชิญ (แสดงครั้งเดียว)')).toHaveCount(0);
  await expect(page.getByText('สมาชิก · บ้านมิว')).toHaveCount(0);
  await expect(page.getByText('เลือกอยู่')).toHaveCount(0);
  expect(violations).toEqual([]);
});

test('API harness delayed responses: slow initial load keeps the honest loading state until data arrives', async ({
  page,
}) => {
  const violations = await openHarness(page, {
    houses: [HOUSE_A],
    meDelay: 1500,
    housesDelay: 1500,
  });
  await expect(page.getByText('API MODE · ไม่มี demo fallback', { exact: true })).toBeVisible();
  // While me/houses are still in flight the screen must show the loading card,
  // not a premature empty or signed-out state.
  await expect(page.getByText('กำลังตรวจสอบ session และบ้าน…')).toBeVisible();
  await expect(page.getByText('ยังไม่ได้เข้าสู่ระบบ', { exact: true })).toHaveCount(0);
  await expect(page.getByText('เชื่อมต่อไม่ได้', { exact: true })).toHaveCount(0);
  await expect(page.getByText('บ้านมิว', { exact: true })).toBeVisible();
  await expect(page.getByText('เลือกอยู่')).toBeVisible();
  expect(violations).toEqual([]);
});

test('API harness delayed responses: late 401 house detail flips the screen to the signed-out state', async ({
  page,
}) => {
  const violations = await openHarness(page, {
    houses: [HOUSE_A],
    detailStatus: { [HOUSE_A.id]: 401 },
    detailDelay: { [HOUSE_A.id]: 1500 },
  });
  await expect(page.getByText('บ้านมิว', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'เปิดบ้าน บ้านมิว', exact: true }).click();
  // The late 401 must clear the session and land on the honest signed-out
  // state, not leave the house open with stale data.
  await expect(page.getByText('ยังไม่ได้เข้าสู่ระบบ', { exact: true })).toBeVisible();
  await expect(page.getByText('บ้านมิว', { exact: true })).toHaveCount(0);
  await expect(page.getByText('สมาชิก · บ้านมิว')).toHaveCount(0);
  expect(violations).toEqual([]);
});

test('API harness delayed responses: slow logout keeps the screen busy then lands signed-out', async ({
  page,
}) => {
  const violations = await openHarness(page, { houses: [HOUSE_A], logoutDelay: 1500 });
  await expect(page.getByText('บ้านมิว', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
  // While the logout POST is still in flight the screen shows the loading
  // state, not a premature signed-out card.
  await expect(page.getByText('กำลังตรวจสอบ session และบ้าน…')).toBeVisible();
  // After the slow logout answers, the harness lands on the index route with
  // no stored credentials: the honest no-session bootstrap error.
  await expect(page.getByText('เชื่อมต่อไม่ได้', { exact: true })).toBeVisible();
  await expect(page.getByText('No authenticated session', { exact: true })).toBeVisible();
  expect(violations).toEqual([]);
});
