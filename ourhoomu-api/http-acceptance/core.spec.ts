import { randomBytes, randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext } from '@playwright/test';

// The fixture server validates this exact loopback origin (default
// http://localhost:8081; round 1 passes http://localhost:18067 explicitly).
const frontendOrigin = process.env.CORE_HTTP_ORIGIN ?? 'http://localhost:8081';

type Session = { accessToken: string; refreshToken: string; userId: string; expiresAt: string };
async function call(
  request: APIRequestContext,
  path: string,
  method = 'GET',
  body?: unknown,
  session?: Session,
  key = randomUUID(),
  raw?: string,
) {
  const response = await request.fetch(path, {
    method,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': key,
      ...(session ? { authorization: `Bearer ${session.accessToken}` } : {}),
    },
    data: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const json = await response.json();
  expect(json.requestId).toBe(response.headers()['x-request-id']);
  expect(response.headers()['cache-control']).toBe('no-store');
  return { status: response.status(), json };
}
async function challenge(request: APIRequestContext, key = randomUUID()) {
  const body = { provider: 'google', clientNonce: randomBytes(32).toString('base64url') };
  const result = await call(request, '/v1/auth/challenges', 'POST', body, undefined, key);
  expect(result.status).toBe(200);
  return { body, data: result.json.data, key };
}
async function proof(
  request: APIRequestContext,
  nonce: string,
  subject = randomUUID(),
  expiresInSeconds = 300,
  email?: string,
) {
  const response = await request.post('/__synthetic/token', {
    data: { nonce, subject, expiresInSeconds, email },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).idToken as string;
}
async function login(request: APIRequestContext, subject = randomUUID(), email?: string) {
  const ch = await challenge(request);
  const input = {
    provider: 'google',
    challengeId: ch.data.id,
    proof: ch.body.clientNonce,
    idToken: await proof(request, ch.data.nonce, subject, 300, email),
  };
  const key = randomUUID();
  const result = await call(request, '/v1/auth/exchange', 'POST', input, undefined, key);
  expect(result.status).toBe(200);
  expect(Object.keys(result.json.data).sort()).toEqual([
    'accessToken',
    'expiresAt',
    'refreshToken',
    'userId',
  ]);
  return { session: result.json.data as Session, input, key };
}
async function house(request: APIRequestContext, session: Session, name = 'Synthetic HTTP house') {
  const result = await call(
    request,
    '/v1/houses',
    'POST',
    { name, timezone: 'Asia/Bangkok' },
    session,
  );
  expect(result.status).toBe(200);
  return result.json.data as { id: string; name: string; timezone: string; version: number };
}
async function inviteAndJoin(request: APIRequestContext, owner: Session, member: Session) {
  const home = await house(request, owner);
  const invitation = await call(
    request,
    `/v1/houses/${home.id}/invitations`,
    'POST',
    { expiresInSeconds: 1200 },
    owner,
  );
  expect(invitation.status).toBe(200);
  const joined = await call(
    request,
    '/v1/invitations/accept',
    'POST',
    { token: invitation.json.data.token },
    member,
  );
  expect(joined.status).toBe(200);
  return { home, membership: joined.json.data as { id: string; active: boolean } };
}

test.beforeAll(() => {
  expect(process.env.ALLOW_CORE_HTTP_ACCEPTANCE).toBe('true');
  expect(process.env.CORE_HTTP_TEST_SHA).toMatch(/^[0-9a-f]{40}$/);
});

test('signed synthetic identities use exact issuer/subject and expose 0/1/many routing data', async ({
  request,
}) => {
  const one = await login(request, randomUUID(), 'same-synthetic@example.invalid');
  const two = await login(request, randomUUID(), 'same-synthetic@example.invalid');
  expect(one.session.userId === two.session.userId).toBe(false);
  expect(
    (await call(request, '/v1/me', 'GET', undefined, one.session)).json.data.houses,
  ).toHaveLength(0);
  const first = await house(request, one.session);
  expect(
    (await call(request, '/v1/me', 'GET', undefined, one.session)).json.data.houses,
  ).toHaveLength(1);
  await house(request, one.session);
  expect(
    (await call(request, '/v1/me', 'GET', undefined, one.session)).json.data.houses,
  ).toHaveLength(2);
  expect(
    (await call(request, `/v1/houses/${first.id}`, 'GET', undefined, two.session)).status,
  ).toBe(404);
  const page = await call(request, '/v1/houses?limit=1', 'GET', undefined, one.session);
  expect(page.json.data).toHaveLength(1);
  expect(typeof page.json.nextCursor).toBe('string');
  const next = await call(
    request,
    `/v1/houses?limit=1&cursor=${page.json.nextCursor}`,
    'GET',
    undefined,
    one.session,
  );
  expect(next.json.data).toHaveLength(1);
  expect(next.json.nextCursor).toBeNull();
});

test('challenge/exchange replay is exact and expired original issuer proof cannot create a fresh session', async ({
  request,
}) => {
  const ch = await challenge(request);
  const again = await call(request, '/v1/auth/challenges', 'POST', ch.body, undefined, ch.key);
  expect(again.status).toBe(200);
  expect(again.json.data).toEqual(ch.data);
  expect(
    (
      await call(
        request,
        '/v1/auth/challenges',
        'POST',
        { ...ch.body, clientNonce: randomBytes(32).toString('base64url') },
        undefined,
        ch.key,
      )
    ).status,
  ).toBe(409);
  const input = {
    provider: 'google',
    challengeId: ch.data.id,
    proof: ch.body.clientNonce,
    idToken: await proof(request, ch.data.nonce, randomUUID(), 30),
  };
  const key = randomUUID();
  const issued = await call(request, '/v1/auth/exchange', 'POST', input, undefined, key);
  expect(issued.status).toBe(200);
  const unused = await challenge(request);
  const unusedInput = {
    provider: 'google',
    challengeId: unused.data.id,
    proof: unused.body.clientNonce,
    idToken: await proof(request, unused.data.nonce, randomUUID(), 30),
  };
  await request.post('/__synthetic/issuer-clock', { data: { advanceSeconds: 120 } });
  try {
    const replay = await call(request, '/v1/auth/exchange', 'POST', input, undefined, key);
    expect(replay.status).toBe(200);
    expect(JSON.stringify(replay.json.data) === JSON.stringify(issued.json.data)).toBe(true);
    expect((await call(request, '/v1/auth/exchange', 'POST', unusedInput)).status).toBe(401);
  } finally {
    await request.post('/__synthetic/issuer-clock', { data: { advanceSeconds: 0 } });
  }
  expect(
    (
      await call(
        request,
        '/v1/auth/exchange',
        'POST',
        { ...input, idToken: `${input.idToken}x` },
        undefined,
        key,
      )
    ).status,
  ).toBe(409);
  expect((await call(request, '/v1/auth/exchange', 'POST', input)).status).toBe(401);
});

test('real refresh concurrent exact retries converge and reuse revokes the entire family', async ({
  request,
}) => {
  const { session } = await login(request);
  const body = { refreshToken: session.refreshToken };
  const key = randomUUID();
  const [first, retry] = await Promise.all([
    call(request, '/v1/auth/refresh', 'POST', body, undefined, key),
    call(request, '/v1/auth/refresh', 'POST', body, undefined, key),
  ]);
  expect(first.status).toBe(200);
  expect(retry.status).toBe(200);
  expect(JSON.stringify(first.json.data) === JSON.stringify(retry.json.data)).toBe(true);
  const bom = await call(
    request,
    '/v1/auth/refresh',
    'POST',
    body,
    undefined,
    key,
    `\ufeff${JSON.stringify(body)}`,
  );
  expect(bom.status).toBe(400);
  expect(bom.json.error.code).toBe('validation_error');
  const validReplay = await call(request, '/v1/auth/refresh', 'POST', body, undefined, key);
  expect(validReplay.status).toBe(200);
  expect(JSON.stringify(validReplay.json.data) === JSON.stringify(first.json.data)).toBe(true);
  expect((await call(request, '/v1/me', 'GET', undefined, session)).status).toBe(401);
  expect((await call(request, '/v1/auth/refresh', 'POST', body)).status).toBe(401);
  expect((await call(request, '/v1/me', 'GET', undefined, first.json.data)).status).toBe(401);
  expect(
    (
      await call(request, '/v1/auth/refresh', 'POST', {
        refreshToken: first.json.data.refreshToken,
      })
    ).status,
  ).toBe(401);
});

test('houses retain timezone, optimistic version checks and body-exact idempotency', async ({
  request,
}) => {
  const { session } = await login(request);
  const key = randomUUID(),
    body = { name: 'Idempotent synthetic', timezone: 'Asia/Bangkok' };
  const created = await call(request, '/v1/houses', 'POST', body, session, key);
  expect(created.status).toBe(200);
  expect((await call(request, '/v1/houses', 'POST', body, session, key)).json.data).toEqual(
    created.json.data,
  );
  expect(
    (await call(request, '/v1/houses', 'POST', { ...body, name: 'Different' }, session, key))
      .status,
  ).toBe(409);
  const updated = await call(
    request,
    `/v1/houses/${created.json.data.id}`,
    'PATCH',
    { name: 'Tokyo', timezone: 'Asia/Tokyo', expectedVersion: 1 },
    session,
  );
  expect(updated.status).toBe(200);
  expect(updated.json.data.timezone).toBe('Asia/Tokyo');
  const stale = await call(
    request,
    `/v1/houses/${created.json.data.id}`,
    'PATCH',
    { name: 'Stale', timezone: 'Asia/Bangkok', expectedVersion: 1 },
    session,
  );
  expect(stale.status).toBe(409);
  expect(stale.json.error.currentVersion).toBe(2);
  expect(
    (await call(request, `/v1/houses/${created.json.data.id}/leave`, 'POST', undefined, session))
      .status,
  ).toBe(403);
});

test('single-use invitation, private membership projection and member removal are enforced by real handlers', async ({
  request,
}) => {
  const owner = (await login(request)).session,
    member = (await login(request)).session,
    outsider = (await login(request)).session;
  const home = await house(request, owner),
    key = randomUUID();
  const invitation = await call(
    request,
    `/v1/houses/${home.id}/invitations`,
    'POST',
    { expiresInSeconds: 1200 },
    owner,
    key,
  );
  expect(invitation.status).toBe(200);
  const ttl =
    Date.parse(invitation.json.data.expiresAt) - Date.parse(invitation.json.data.createdAt);
  expect(ttl).toBe(1200000);
  const replay = await call(
    request,
    `/v1/houses/${home.id}/invitations`,
    'POST',
    { expiresInSeconds: 1200 },
    owner,
    key,
  );
  expect(replay.status).toBe(200);
  expect(replay.json.data.token === invitation.json.data.token).toBe(true);
  const joined = await call(
    request,
    '/v1/invitations/accept',
    'POST',
    { token: invitation.json.data.token },
    member,
  );
  expect(joined.status).toBe(200);
  expect(Object.keys(joined.json.data).sort()).toEqual([
    'active',
    'displayName',
    'id',
    'role',
    'version',
  ]);
  expect(
    (
      await call(
        request,
        '/v1/invitations/accept',
        'POST',
        { token: invitation.json.data.token },
        outsider,
      )
    ).status,
  ).toBe(409);
  expect(
    (await call(request, `/v1/houses/${home.id}/members`, 'GET', undefined, outsider)).status,
  ).toBe(404);
  const members = await call(request, `/v1/houses/${home.id}/members`, 'GET', undefined, member);
  expect(members.status).toBe(200);
  expect(
    members.json.data.every(
      (item: Record<string, unknown>) => !('userId' in item) && !('houseId' in item),
    ),
  ).toBe(true);
  const removeKey = randomUUID();
  const removed = await call(
    request,
    `/v1/houses/${home.id}/members/${joined.json.data.id}`,
    'DELETE',
    undefined,
    owner,
    removeKey,
  );
  expect(removed.status).toBe(200);
  expect(removed.json.data.active).toBe(false);
  const removalReplay = await call(
    request,
    `/v1/houses/${home.id}/members/${joined.json.data.id}`,
    'DELETE',
    undefined,
    owner,
    removeKey,
  );
  expect(removalReplay.status).toBe(200);
  expect(removalReplay.json.data.active).toBe(false);
  expect((await call(request, `/v1/houses/${home.id}`, 'GET', undefined, member)).status).toBe(404);
  const second = await call(
    request,
    `/v1/houses/${home.id}/invitations`,
    'POST',
    { expiresInSeconds: 604800 },
    owner,
  );
  const revoked = await call(
    request,
    `/v1/houses/${home.id}/invitations/${second.json.data.id}`,
    'DELETE',
    undefined,
    owner,
  );
  expect(revoked.status).toBe(200);
  expect(revoked.json.data.status).toBe('revoked');
  expect('token' in revoked.json.data).toBe(false);
});

test('owner-only recipient accounts encrypt identifiers, merge bank changes and archive without leaking private fields', async ({
  request,
}) => {
  const owner = (await login(request)).session,
    outsider = (await login(request)).session;
  const created = await call(
    request,
    '/v1/me/recipient-accounts',
    'POST',
    { bankCode: 'SCB', label: 'Synthetic', accountNumber: '0012345678', isDefault: true },
    owner,
  );
  expect(created.status).toBe(200);
  expect(Object.keys(created.json.data).sort()).toEqual([
    'active',
    'bankCode',
    'id',
    'isDefault',
    'label',
    'maskedAccount',
    'version',
  ]);
  expect(created.json.data.maskedAccount).toBe('••••5678');
  const id = created.json.data.id;
  expect(
    (
      await call(
        request,
        `/v1/me/recipient-accounts/${id}`,
        'PATCH',
        { label: 'No access', expectedVersion: 1 },
        outsider,
      )
    ).status,
  ).toBe(404);
  expect(
    (await call(request, '/v1/me/recipient-accounts', 'GET', undefined, outsider)).json.data,
  ).toHaveLength(0);
  const changed = await call(
    request,
    `/v1/me/recipient-accounts/${id}`,
    'PATCH',
    { bankCode: 'KBANK', expectedVersion: 1 },
    owner,
  );
  expect(changed.status).toBe(200);
  expect(changed.json.data.maskedAccount).toBe('••••5678');
  expect(
    (
      await call(
        request,
        `/v1/me/recipient-accounts/${id}`,
        'PATCH',
        { label: 'Stale', expectedVersion: 1 },
        owner,
      )
    ).status,
  ).toBe(409);
  const archived = await call(
    request,
    `/v1/me/recipient-accounts/${id}`,
    'PATCH',
    { active: false, expectedVersion: changed.json.data.version },
    owner,
  );
  expect(archived.status).toBe(200);
  expect(archived.json.data.active).toBe(false);
});

test('exact loopback frontend origin contract serves the selected UI origin', async ({
  request,
}) => {
  const preflight = await request.fetch('/v1/houses', {
    method: 'OPTIONS',
    headers: {
      origin: frontendOrigin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization,content-type,idempotency-key',
    },
  });
  expect(preflight.status()).toBe(204);
  expect(preflight.headers()['access-control-allow-origin']).toBe(frontendOrigin);
  expect(preflight.headers()['access-control-allow-headers']).toBe(
    'authorization,content-type,idempotency-key',
  );
  expect(preflight.headers()['access-control-allow-methods']).toContain('POST');
  const actual = await request.fetch('/health', { headers: { origin: frontendOrigin } });
  expect(actual.status()).toBe(200);
  expect(actual.headers()['access-control-allow-origin']).toBe(frontendOrigin);
  expect(actual.headers()['access-control-expose-headers']).toContain('x-request-id');
  expect(actual.headers()['access-control-max-age']).toBe('600');
  const syntheticPreflight = await request.fetch('/__synthetic/token', {
    method: 'OPTIONS',
    headers: {
      origin: frontendOrigin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  expect(syntheticPreflight.status()).toBe(204);
  expect(syntheticPreflight.headers()['access-control-allow-origin']).toBe(frontendOrigin);
  expect(
    (
      await request.fetch('/__synthetic/token', {
        method: 'POST',
        headers: { origin: 'http://localhost:39999', 'content-type': 'application/json' },
        data: '{}',
      })
    ).status(),
  ).toBe(403);
});

test('multi-house membership keeps cross-house boundaries and delayed responses after removal preserve correct state', async ({
  request,
}) => {
  const owner = (await login(request)).session,
    member = (await login(request)).session,
    outsider = (await login(request)).session;
  const first = await inviteAndJoin(request, owner, member);
  const second = await inviteAndJoin(request, owner, member);
  expect(first.home.id === second.home.id).toBe(false);
  const memberMe = (await call(request, '/v1/me', 'GET', undefined, member)).json.data;
  expect(memberMe.houses.map((item: { id: string }) => item.id).sort()).toEqual(
    [first.home.id, second.home.id].sort(),
  );
  expect((await call(request, '/v1/me', 'GET', undefined, owner)).json.data.houses).toHaveLength(2);
  expect(
    (await call(request, `/v1/houses/${first.home.id}`, 'GET', undefined, outsider)).status,
  ).toBe(404);
  expect(
    (await call(request, `/v1/houses/${second.home.id}/members`, 'GET', undefined, outsider))
      .status,
  ).toBe(404);
  expect(
    (
      await call(
        request,
        `/v1/houses/${second.home.id}/invitations`,
        'POST',
        { expiresInSeconds: 600 },
        outsider,
      )
    ).status,
  ).toBe(404);
  const removed = await call(
    request,
    `/v1/houses/${first.home.id}/members/${first.membership.id}`,
    'DELETE',
    undefined,
    owner,
  );
  expect(removed.status).toBe(200);
  expect(
    (await call(request, `/v1/houses/${first.home.id}`, 'GET', undefined, member)).status,
  ).toBe(404);
  expect(
    (await call(request, `/v1/houses/${first.home.id}/members`, 'GET', undefined, member)).status,
  ).toBe(404);
  expect(
    (await call(request, `/v1/houses/${second.home.id}`, 'GET', undefined, member)).status,
  ).toBe(200);
  const remaining = (await call(request, '/v1/me', 'GET', undefined, member)).json.data;
  expect(remaining.houses.map((item: { id: string }) => item.id)).toEqual([second.home.id]);
  const members = await call(
    request,
    `/v1/houses/${second.home.id}/members`,
    'GET',
    undefined,
    member,
  );
  expect(members.status).toBe(200);
  expect(members.json.data).toHaveLength(2);
  expect(members.json.data.map((item: { id: string }) => item.id)).toContain(second.membership.id);
});

test('member logout after house membership keeps boundaries for delayed refresh and leaves other sessions intact', async ({
  request,
}) => {
  const owner = (await login(request)).session,
    member = (await login(request)).session;
  const { home } = await inviteAndJoin(request, owner, member);
  expect((await call(request, `/v1/houses/${home.id}`, 'GET', undefined, member)).status).toBe(200);
  expect((await call(request, '/v1/auth/logout', 'POST', undefined, member)).status).toBe(200);
  expect((await call(request, '/v1/me', 'GET', undefined, member)).status).toBe(401);
  expect(
    (await call(request, '/v1/auth/refresh', 'POST', { refreshToken: member.refreshToken })).status,
  ).toBe(401);
  expect((await call(request, `/v1/houses/${home.id}`, 'GET', undefined, owner)).status).toBe(200);
  const members = await call(request, `/v1/houses/${home.id}/members`, 'GET', undefined, owner);
  expect(members.status).toBe(200);
  expect(members.json.data).toHaveLength(2);
  expect(members.json.data.every((item: { active: boolean }) => item.active)).toBe(true);
});

test('expired single-use invitation is refused after its declared lifetime', async ({
  request,
}) => {
  const owner = (await login(request)).session,
    member = (await login(request)).session;
  const home = await house(request, owner);
  const invitation = await call(
    request,
    `/v1/houses/${home.id}/invitations`,
    'POST',
    { expiresInSeconds: 1 },
    owner,
  );
  expect(invitation.status).toBe(200);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const refused = await call(
    request,
    '/v1/invitations/accept',
    'POST',
    { token: invitation.json.data.token },
    member,
  );
  expect(refused.status).toBe(409);
  expect(refused.json.error.code).toBe('invite_unavailable');
  expect(
    (await call(request, `/v1/houses/${home.id}/members`, 'GET', undefined, member)).status,
  ).toBe(404);
});

test('logout wins over both refresh and exchange replay; deletion remains explicit gated behavior', async ({
  request,
}) => {
  const signedIn = await login(request);
  expect(
    (
      await call(
        request,
        '/v1/me',
        'DELETE',
        { reauthProof: 'synthetic-fresh-proof', expectedVersion: 1 },
        signedIn.session,
      )
    ).status,
  ).toBe(503);
  expect((await call(request, '/v1/auth/logout', 'POST', undefined, signedIn.session)).status).toBe(
    200,
  );
  expect((await call(request, '/v1/me', 'GET', undefined, signedIn.session)).status).toBe(401);
  expect(
    (
      await call(request, '/v1/auth/refresh', 'POST', {
        refreshToken: signedIn.session.refreshToken,
      })
    ).status,
  ).toBe(401);
  expect(
    (await call(request, '/v1/auth/exchange', 'POST', signedIn.input, undefined, signedIn.key))
      .status,
  ).toBe(401);
});
