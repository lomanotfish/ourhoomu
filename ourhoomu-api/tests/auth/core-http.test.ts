import { expect, test } from 'bun:test';
import { createApp } from '../../src/app';

const app = createApp({ appEnv: 'test', allowedOrigin: 'http://localhost:8081' });
async function call(path: string, method = 'GET', body?: unknown, headers = {}) {
  return app.fetch(
    new Request(`https://api.test/v1${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
test('core endpoints fail closed without explicitly configured server credentials', async () => {
  const response = await call('/auth/challenges', 'POST', {
    provider: 'google',
    clientNonce: 'a'.repeat(32),
  });
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ error: { code: 'feature_unavailable' } });
  expect(response.headers.get('cache-control')).toBe('no-store');
});
test('actor headers cannot authenticate protected profile routes', async () => {
  const response = await call('/me', 'GET', undefined, {
    'x-user-id': crypto.randomUUID(),
    'x-actor-id': crypto.randomUUID(),
  });
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ error: { code: 'unauthenticated' } });
});

import { sessionFixture } from '../fixtures/core-session';

async function syntheticClient() {
  const fixture = await sessionFixture();
  const configured = createApp(
    { appEnv: 'test', allowedOrigin: 'http://localhost:8081' },
    { sessions: fixture.sessions },
  );
  const request = async (
    path: string,
    method: string,
    body?: unknown,
    headers = {},
    raw?: string,
  ) => {
    const response = await configured.fetch(
      new Request(`https://api.test/v1${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
          ...headers,
        },
        body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      }),
    );
    return {
      response,
      json: (await response.json()) as {
        data: Record<string, string>;
        error: { code: string; currentVersion?: number };
        requestId: string;
      },
    };
  };
  const signIn = async () => {
    const proof = 'n'.repeat(43);
    const ch = await request('/auth/challenges', 'POST', {
      provider: 'google',
      clientNonce: proof,
    });
    const input = {
      provider: 'google',
      challengeId: ch.json.data.id,
      proof,
      idToken: await fixture.token(ch.json.data.nonce),
    };
    return { input, result: await request('/auth/exchange', 'POST', input) };
  };
  return { ...fixture, request, signIn };
}

test('synthetic signed exchange minimizes DTO and consumes challenge exactly once', async () => {
  const client = await syntheticClient();
  const { input, result } = await client.signIn();
  expect(result.response.status).toBe(200);
  expect(Object.keys(result.json.data).sort()).toEqual([
    'accessToken',
    'expiresAt',
    'refreshToken',
    'userId',
  ]);
  expect(result.json.data.userId).toBe(client.userId);
  expect(result.json.data.accessToken).toHaveLength(43);
  expect((await client.request('/auth/exchange', 'POST', input)).response.status).toBe(401);
});

test('synthetic refresh replays identical credentials and changed-body reuse revokes the winning session', async () => {
  const client = await syntheticClient();
  const original = (await client.signIn()).result.json.data;
  const body = { refreshToken: original.refreshToken };
  const headers = { 'idempotency-key': '00000000-0000-4000-8000-000000000001' };
  const first = await client.request('/auth/refresh', 'POST', body, headers);
  expect(first.response.status).toBe(200);
  expect(first.json.data.accessToken).not.toBe(original.accessToken);
  expect((await client.request('/auth/refresh', 'POST', body, headers)).json.data).toEqual(
    first.json.data,
  );
  await expect(client.sessions.authenticate(`Bearer ${original.accessToken}`)).rejects.toThrow();
  expect(
    (await client.request('/auth/refresh', 'POST', body, headers, JSON.stringify(body, null, 2)))
      .response.status,
  ).toBe(401);
  await expect(
    client.sessions.authenticate(`Bearer ${first.json.data.accessToken}`),
  ).rejects.toThrow();
});

test('validation rejects unknown identity fields, malformed proof, missing key and oversized input', async () => {
  const client = await syntheticClient();
  for (const input of [
    { provider: 'google', clientNonce: 'n'.repeat(43), userId: crypto.randomUUID() },
    { provider: 'google', clientNonce: 'short' },
    { provider: 'google', clientNonce: '$'.repeat(32) },
    { provider: 'attacker', clientNonce: 'n'.repeat(43) },
  ])
    expect((await client.request('/auth/challenges', 'POST', input)).response.status).toBe(400);
  expect(
    (
      await client.request(
        '/auth/refresh',
        'POST',
        { refreshToken: 'r'.repeat(43) },
        { 'idempotency-key': '' },
      )
    ).response.status,
  ).toBe(400);
  expect(
    (await client.request('/auth/challenges', 'POST', undefined, {}, '{')).response.status,
  ).toBe(400);
  expect(
    (
      await client.request('/auth/challenges', 'POST', {
        provider: 'google',
        clientNonce: 'n'.repeat(17000),
      })
    ).response.status,
  ).toBe(400);
});

test('BOM-prefixed refresh is rejected without changing exact valid-body replay', async () => {
  const client = await syntheticClient();
  const original = (await client.signIn()).result.json.data;
  const body = { refreshToken: original.refreshToken };
  const raw = JSON.stringify(body);
  const headers = { 'idempotency-key': crypto.randomUUID() };
  const first = await client.request('/auth/refresh', 'POST', body, headers, raw);
  expect(first.response.status).toBe(200);
  const noncanonical = await client.request('/auth/refresh', 'POST', body, headers, `\ufeff${raw}`);
  expect(noncanonical.response.status).toBe(400);
  expect(noncanonical.json.error.code).toBe('validation_error');
  const replay = await client.request('/auth/refresh', 'POST', body, headers, raw);
  expect(replay.response.status).toBe(200);
  expect(JSON.stringify(replay.json.data) === JSON.stringify(first.json.data)).toBe(true);
});

test('signed wrong nonce and expired challenge fail authentication without consuming a valid challenge', async () => {
  const client = await syntheticClient();
  const proof = 'p'.repeat(43);
  const ch = (
    await client.request('/auth/challenges', 'POST', { provider: 'google', clientNonce: proof })
  ).json.data;
  const body = {
    provider: 'google',
    challengeId: ch.id,
    proof,
    idToken: await client.token('wrong-nonce'),
  };
  expect((await client.request('/auth/exchange', 'POST', body)).response.status).toBe(401);
  client.advance(300001);
  body.idToken = await client.token(ch.nonce);
  expect((await client.request('/auth/exchange', 'POST', body)).response.status).toBe(401);
});

test('unconfigured provider fails closed and internal data errors never leak detail', async () => {
  const client = await syntheticClient();
  expect(
    (
      await client.request('/auth/challenges', 'POST', {
        provider: 'apple',
        clientNonce: 'p'.repeat(43),
      })
    ).response.status,
  ).toBe(503);
  client.state.failure = 'secret_database_error';
  const result = await client.request('/auth/challenges', 'POST', {
    provider: 'google',
    clientNonce: 'p'.repeat(43),
  });
  expect(result.response.status).toBe(500);
  expect(JSON.stringify(result.json)).not.toContain('secret_database_error');
});

test('only version conflicts carry currentVersion and every response has matching request identifiers', async () => {
  const client = await syntheticClient();
  for (const [code, status] of [
    ['unauthenticated', 401],
    ['forbidden', 403],
    ['not_found', 404],
    ['version_conflict', 409],
    ['idempotency_conflict', 409],
    ['expired', 410],
    ['rate_limited', 429],
    ['feature_unavailable', 503],
  ] as const) {
    client.state.failure = code;
    const result = await client.request('/auth/challenges', 'POST', {
      provider: 'google',
      clientNonce: 'p'.repeat(43),
    });
    expect(result.response.status).toBe(status);
    expect(result.json.error.code).toBe(code);
    expect(result.json.requestId).toBe(result.response.headers.get('x-request-id') ?? '');
    expect(result.json.error.currentVersion).toBe(code === 'version_conflict' ? 7 : undefined);
  }
});

test('authenticated house list strips internal fields and paginates bounded results', async () => {
  const client = await syntheticClient();
  const signedIn = (await client.signIn()).result.json.data;
  const houses = Array.from({ length: 3 }, (_, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    name: `House ${index}`,
    timezone: 'Asia/Bangkok',
    version: 1,
    state: 'active',
    createdByUserId: 'private-user',
  }));
  const data = {
    async withPrincipal<T>(_principal: unknown, work: (tx: HttpTransaction) => Promise<T>) {
      return work(
        transactionFixture({
          houses: async ({ limit = 20, cursor } = {}) =>
            houses.filter((row) => !cursor || row.id > cursor).slice(0, limit),
          accounts: async () => [],
        }),
      );
    },
  };
  const configured = createApp(
    { appEnv: 'test', allowedOrigin: 'http://localhost:8081' },
    { sessions: client.sessions, data },
  );
  const response = await configured.fetch(
    new Request('https://api.test/v1/houses?limit=2', {
      headers: { authorization: `Bearer ${signedIn.accessToken}` },
    }),
  );
  const json = (await response.json()) as {
    data: Array<Record<string, unknown>>;
    nextCursor: string;
  };
  expect(response.status).toBe(200);
  expect(json.data).toHaveLength(2);
  expect(json.data[0]).toEqual({
    id: houses[0].id,
    name: 'House 0',
    timezone: 'Asia/Bangkok',
    version: 1,
  });
  expect(typeof json.nextCursor).toBe('string');
  const second = await configured.fetch(
    new Request(`https://api.test/v1/houses?limit=2&cursor=${json.nextCursor}`, {
      headers: { authorization: `Bearer ${signedIn.accessToken}` },
    }),
  );
  expect(await second.json()).toMatchObject({ data: [{ name: 'House 2' }], nextCursor: null });
  const tampered = `${json.nextCursor.slice(0, -1)}${json.nextCursor.endsWith('0') ? '1' : '0'}`;
  const otherUser = await client.sessions.secrets.mac('list-cursor', [
    `${crypto.randomUUID()}:/v1/houses`,
    houses[0].id,
  ]);
  const otherRoute = await client.sessions.secrets.mac('list-cursor', [
    `${signedIn.userId}:/v1/me/recipient-accounts`,
    houses[0].id,
  ]);
  for (const path of [
    `/houses?cursor=${tampered}`,
    `/houses?cursor=${houses[0].id}.${otherUser}`,
    `/houses?cursor=${houses[0].id}.${otherRoute}`,
    `/me/recipient-accounts?cursor=${json.nextCursor}`,
    '/houses?limit=101',
    '/houses?limit=0',
    '/houses?limit=1.5',
  ]) {
    const rejected = await configured.fetch(
      new Request(`https://api.test/v1${path}`, {
        headers: { authorization: `Bearer ${signedIn.accessToken}` },
      }),
    );
    expect(rejected.status).toBe(400);
  }
});
import type { HttpTransaction } from '../../src/modules/core/data';

import { transactionFixture } from '../fixtures/core-data';

test('synthetic challenge and exchange enforce UUID idempotency and replay exact encrypted results', async () => {
  const client = await syntheticClient();
  const body = { provider: 'google', clientNonce: 'q'.repeat(43) };
  expect(
    (await client.request('/auth/challenges', 'POST', body, { 'idempotency-key': '' })).response
      .status,
  ).toBe(400);
  expect(
    (await client.request('/auth/challenges', 'POST', body, { 'idempotency-key': 'not-a-uuid' }))
      .response.status,
  ).toBe(400);
  const key = crypto.randomUUID();
  const headers = { 'idempotency-key': key };
  const first = await client.request('/auth/challenges', 'POST', body, headers);
  expect((await client.request('/auth/challenges', 'POST', body, headers)).json.data).toEqual(
    first.json.data,
  );
  expect(
    (
      await client.request(
        '/auth/challenges',
        'POST',
        { ...body, clientNonce: 'z'.repeat(43) },
        headers,
      )
    ).response.status,
  ).toBe(409);
  const exchange = {
    provider: 'google',
    challengeId: first.json.data.id,
    proof: body.clientNonce,
    idToken: await client.token(first.json.data.nonce, { exp: Math.floor(Date.now() / 1000) + 1 }),
  };
  const exchangeHeaders = { 'idempotency-key': crypto.randomUUID() };
  const signedIn = await client.request('/auth/exchange', 'POST', exchange, exchangeHeaders);
  expect(signedIn.response.status).toBe(200);
  client.advance(120000);
  expect(
    (await client.request('/auth/exchange', 'POST', exchange, exchangeHeaders)).json.data,
  ).toEqual(signedIn.json.data);
});

test('JSON mutation routes reject other content types and declared oversized bodies', async () => {
  const client = await syntheticClient();
  const body = { provider: 'google', clientNonce: 'n'.repeat(43) };
  expect(
    (await client.request('/auth/challenges', 'POST', body, { 'content-type': 'text/plain' }))
      .response.status,
  ).toBe(400);
  expect(
    (await client.request('/auth/challenges', 'POST', body, { 'content-length': '20000' })).response
      .status,
  ).toBe(400);
});

test('actual request bytes enforce body bounds and reject invalid UTF-8 before authority calls', async () => {
  const fixture = await sessionFixture();
  const configured = createApp(
    { appEnv: 'test', allowedOrigin: 'http://localhost:8081' },
    { sessions: fixture.sessions },
  );
  for (const body of [
    new Uint8Array([0x7b, 0xff, 0x7d]),
    new TextEncoder().encode('x'.repeat(16385)),
  ]) {
    const response = await configured.fetch(
      new Request('https://api.test/v1/auth/challenges', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '1',
          'idempotency-key': crypto.randomUUID(),
        },
        body,
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'validation_error' } });
    expect(fixture.state.lastInput).toEqual({});
  }
});
