import { expect, test } from 'bun:test';
import { createApiClient } from '../api/client';
import { ApiHttpError, OfflineMutationError } from '../api/errors';
import { createHouseRepository } from './houses';
import type { House, Member, OwnAccount, InvitationIssued, InvitationMetadata } from './contracts';

const houseId = '550e8400-e29b-41d4-a716-446655440001';
const resourceId = '550e8400-e29b-41d4-a716-446655440002';
const key = '550e8400-e29b-41d4-a716-446655440099';
const house: House = { id: houseId, name: 'บ้าน', timezone: 'Asia/Bangkok', version: 2 };
const member: Member = {
  id: resourceId,
  displayName: 'A',
  role: 'member',
  active: true,
  version: 1,
};
const account: OwnAccount = {
  id: resourceId,
  version: 1,
  bankCode: 'SCB',
  label: 'Main',
  maskedAccount: '••7890',
  isDefault: true,
  active: true,
};
const invitation: InvitationMetadata = {
  id: resourceId,
  houseId,
  status: 'active',
  expiresAt: '2026-10-20T00:00:00Z',
  createdAt: '2026-10-13T00:00:00Z',
};
const issued: InvitationIssued = { ...invitation, token: 'one-time-token' };
const mutation = { idempotencyKey: key };
const session = {
  getAccessToken: async () => 'fixture-access',
  refreshAfterUnauthorized: async () => null,
};

function setup(data: unknown = house, isOnline = true, nextCursor: string | null = null) {
  const requests: Request[] = [];
  const client = createApiClient({
    baseUrl: 'https://api.example.test',
    session,
    isOnline: () => isOnline,
    fetcher: async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json({ data, nextCursor, requestId: key });
    },
  });
  return { repository: createHouseRepository(client), requests };
}

test('fixture transport receives frozen house/account routes, bodies and data projections', async () => {
  const cases = [
    {
      method: 'GET',
      path: '/v1/houses',
      data: [house],
      body: undefined,
      call: (r: ReturnType<typeof createHouseRepository>) => r.list(),
    },
    {
      method: 'POST',
      path: '/v1/houses',
      data: house,
      body: { name: house.name, timezone: house.timezone },
      call: (r: ReturnType<typeof createHouseRepository>) =>
        r.create({ name: house.name, timezone: house.timezone }, mutation),
    },
    {
      method: 'GET',
      path: `/v1/houses/${houseId}`,
      data: house,
      body: undefined,
      call: (r: ReturnType<typeof createHouseRepository>) => r.detail(houseId),
    },
    {
      method: 'PATCH',
      path: `/v1/houses/${houseId}`,
      data: house,
      body: { name: house.name, timezone: house.timezone, expectedVersion: 1 },
      call: (r: ReturnType<typeof createHouseRepository>) =>
        r.rename(
          houseId,
          { name: house.name, timezone: house.timezone, expectedVersion: 1 },
          mutation,
        ),
    },
    {
      method: 'GET',
      path: `/v1/houses/${houseId}/members`,
      data: [member],
      body: undefined,
      call: (r: ReturnType<typeof createHouseRepository>) => r.members(houseId),
    },
    {
      method: 'POST',
      path: `/v1/houses/${houseId}/invitations`,
      data: issued,
      body: { expiresInSeconds: 604800 },
      call: (r: ReturnType<typeof createHouseRepository>) =>
        r.issueInvitation(houseId, { expiresInSeconds: 604800 }, mutation),
    },
    {
      method: 'POST',
      path: '/v1/invitations/accept',
      data: member,
      body: { token: 'one-time-token' },
      call: (r: ReturnType<typeof createHouseRepository>) =>
        r.acceptInvitation({ token: 'one-time-token' }, mutation),
    },
    {
      method: 'DELETE',
      path: `/v1/houses/${houseId}/invitations/${resourceId}`,
      data: invitation,
      body: undefined,
      call: (r: ReturnType<typeof createHouseRepository>) =>
        r.revokeInvitation(houseId, resourceId, mutation),
    },
    {
      method: 'POST',
      path: `/v1/houses/${houseId}/leave`,
      data: member,
      body: undefined,
      call: (r: ReturnType<typeof createHouseRepository>) => r.leave(houseId, mutation),
    },
    {
      method: 'DELETE',
      path: `/v1/houses/${houseId}/members/${resourceId}`,
      data: member,
      body: undefined,
      call: (r: ReturnType<typeof createHouseRepository>) =>
        r.removeMember(houseId, resourceId, mutation),
    },
    {
      method: 'GET',
      path: '/v1/me/recipient-accounts',
      data: [account],
      body: undefined,
      call: (r: ReturnType<typeof createHouseRepository>) => r.listOwnAccounts(),
    },
    {
      method: 'POST',
      path: '/v1/me/recipient-accounts',
      data: account,
      body: { bankCode: 'SCB', label: 'Main', accountNumber: '1234567890' },
      call: (r: ReturnType<typeof createHouseRepository>) =>
        r.createOwnAccount(
          { bankCode: 'SCB', label: 'Main', accountNumber: '1234567890' },
          mutation,
        ),
    },
    {
      method: 'PATCH',
      path: `/v1/me/recipient-accounts/${resourceId}`,
      data: account,
      body: { active: false, expectedVersion: 1 },
      call: (r: ReturnType<typeof createHouseRepository>) =>
        r.patchOwnAccount(resourceId, { active: false, expectedVersion: 1 }, mutation),
    },
  ];
  for (const c of cases) {
    const { repository, requests } = setup(c.data);
    const result: unknown = await c.call(repository);
    expect(result).toEqual(
      Array.isArray(c.data) ? { data: c.data, nextCursor: null, requestId: key } : c.data,
    );
    expect(requests).toHaveLength(1);
    const req = requests[0]!;
    expect(req.method).toBe(c.method);
    expect(new URL(req.url).pathname).toBe(c.path);
    expect(await req.text()).toBe(c.body === undefined ? '' : JSON.stringify(c.body));
    expect(req.headers.get('Idempotency-Key')).toBe(c.method === 'GET' ? null : key);
  }
});

test('encodes opaque cursors without query or path injection on each list', async () => {
  const { repository, requests } = setup([], true, 'next-page');
  const query = { cursor: 'a+/=&?#บ้าน', limit: 100 };
  expect((await repository.list(query)).nextCursor).toBe('next-page');
  expect((await repository.members(houseId, query)).nextCursor).toBe('next-page');
  expect((await repository.listOwnAccounts(query)).nextCursor).toBe('next-page');
  for (const req of requests) {
    const url = new URL(req.url);
    expect(url.searchParams.get('cursor')).toBe(query.cursor);
    expect(url.searchParams.get('limit')).toBe('100');
    expect([...url.searchParams.keys()]).toEqual(['cursor', 'limit']);
    expect(url.hash).toBe('');
  }
});

test('rejects unsafe IDs, keys, query and versions before transport', async () => {
  const { repository, requests } = setup();
  for (const id of [
    '',
    '..',
    '../me',
    '%2e%2e',
    'a/b',
    'a?x=1',
    'a#b',
    ' a ',
    '\\',
    houseId + '/',
  ]) {
    await expect(repository.detail(id)).rejects.toBeInstanceOf(TypeError);
    await expect(repository.members(id)).rejects.toBeInstanceOf(TypeError);
    await expect(repository.revokeInvitation(houseId, id, mutation)).rejects.toBeInstanceOf(
      TypeError,
    );
    await expect(repository.removeMember(houseId, id, mutation)).rejects.toBeInstanceOf(TypeError);
    await expect(
      repository.patchOwnAccount(id, { expectedVersion: 1 }, mutation),
    ).rejects.toBeInstanceOf(TypeError);
  }
  for (const limit of [0, -1, 101, 1.5, NaN, Infinity])
    await expect(repository.list({ limit })).rejects.toBeInstanceOf(TypeError);
  for (const cursor of ['', '\u0000', '\ud800'])
    await expect(repository.list({ cursor })).rejects.toBeInstanceOf(TypeError);
  for (const idempotencyKey of ['', 'new-key', key + '\n'])
    await expect(repository.leave(houseId, { idempotencyKey })).rejects.toBeInstanceOf(TypeError);
  for (const expectedVersion of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(
      repository.rename(
        houseId,
        { name: 'A', timezone: 'Asia/Bangkok', expectedVersion },
        mutation,
      ),
    ).rejects.toBeInstanceOf(TypeError);
    await expect(
      repository.patchOwnAccount(resourceId, { expectedVersion }, mutation),
    ).rejects.toBeInstanceOf(TypeError);
  }
  expect(requests).toHaveLength(0);
});

test('caller retries preserve the key and payload; no repository replay on conflict', async () => {
  const requests: Request[] = [];
  const repository = createHouseRepository(
    createApiClient({
      baseUrl: 'https://api.example.test',
      session,
      fetcher: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json(
          {
            error: { code: 'version_conflict', message: 'stale', currentVersion: 2 },
            requestId: key,
          },
          { status: 409 },
        );
      },
    }),
  );
  const body = { name: house.name, timezone: house.timezone, expectedVersion: 1 };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await repository.rename(houseId, body, mutation);
      throw new Error('expected conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiHttpError);
      if (error instanceof ApiHttpError) {
        expect(error.status).toBe(409);
        expect(error.currentVersion).toBe(2);
      }
    }
    expect(requests).toHaveLength(attempt + 1);
  }
  for (const req of requests) {
    expect(req.headers.get('Idempotency-Key')).toBe(key);
    expect(await req.json()).toEqual(body);
  }
});

test('offline mutation, cancellation and network failures propagate without retries', async () => {
  const offline = setup(house, false);
  await expect(offline.repository.leave(houseId, mutation)).rejects.toBeInstanceOf(
    OfflineMutationError,
  );
  expect(offline.requests).toHaveLength(0);
  const abort = new AbortController();
  abort.abort();
  const online = setup();
  await expect(online.repository.detail(houseId, { signal: abort.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(online.requests).toHaveLength(0);
  const failure = new TypeError('fixture network unavailable');
  let calls = 0;
  const repository = createHouseRepository(
    createApiClient({
      baseUrl: 'https://api.example.test',
      session,
      fetcher: async () => {
        calls++;
        throw failure;
      },
    }),
  );
  await expect(repository.detail(houseId)).rejects.toBe(failure);
  expect(calls).toBe(1);
});
