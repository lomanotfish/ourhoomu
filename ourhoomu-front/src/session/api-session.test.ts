import { expect, test } from 'bun:test';
import { createApiClient } from '../api/client';
import { ApiHttpError } from '../api/errors';
import { createSessionAuthority } from './authority';
import { createApiSession, type Session } from './api-session';
import type { CredentialStore } from './authority';

const sid = '550e8400-e29b-41d4-a716-446655440001';
const requestId = '550e8400-e29b-41d4-a716-446655440099';
const valid: Session = {
  accessToken: 'access',
  refreshToken: 'refresh',
  userId: sid,
  expiresAt: '2099-01-01T00:00:00Z',
};
const me = { id: sid, displayName: 'Ada', houses: [] };

function store(
  initial: Session | null = valid,
): CredentialStore & { value: Session | null; clears: number } {
  return {
    value: initial,
    clears: 0,
    async load() {
      return this.value;
    },
    async save(value) {
      this.value = value;
    },
    async clear() {
      this.clears++;
      this.value = null;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function response(data: unknown, status = 200) {
  return Response.json(status === 200 ? { data, requestId } : data, { status });
}

test('bootstrap validates protected profile and only sends current bearer credential', async () => {
  const credentials = store();
  const seen: Request[] = [];
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  const api = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    fetcher: async (input, init) => {
      seen.push(new Request(input, init));
      return response(me);
    },
  });
  expect(await api.bootstrap()).toEqual(me);
  expect(seen[0]?.headers.get('authorization')).toBe('Bearer access');
  expect(seen[0]?.url).toBe('https://api.example.test/v1/me');
});

test('401 bootstrap clears credential and authenticated cache, never falls back', async () => {
  const credentials = store();
  let cacheClears = 0;
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  const api = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    onAuthenticatedCacheClear: () => {
      cacheClears++;
    },
    fetcher: async () =>
      response({ error: { code: 'unauthenticated', message: 'No session' }, requestId }, 401),
  });
  await expect(api.bootstrap()).rejects.toBeInstanceOf(ApiHttpError);
  expect(credentials.value).toBeNull();
  expect(credentials.clears).toBe(1);
  expect(cacheClears).toBe(1);
});

test('logout revokes remotely and clears local session even if server rejects', async () => {
  const credentials = store();
  let cacheClears = 0;
  let logoutRequest: Request | undefined;
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  const api = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    createIdempotencyKey: () => requestId,
    onAuthenticatedCacheClear: () => {
      cacheClears++;
    },
    fetcher: async (input, init) => {
      logoutRequest = new Request(input, init);
      return response({ error: { code: 'unauthenticated', message: 'Revoked' }, requestId }, 401);
    },
  });
  await expect(api.logout()).rejects.toBeInstanceOf(ApiHttpError);
  expect(logoutRequest?.url).toBe('https://api.example.test/v1/auth/logout');
  expect(logoutRequest?.headers.get('idempotency-key')).toBe(requestId);
  expect(credentials.value).toBeNull();
  expect(cacheClears).toBe(1);
});

test('acceptSession replaces the canonical transport token and rejects the old token', async () => {
  const credentials = store();
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  const seen: Request[] = [];
  const sessionApi = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    fetcher: async (input, init) => {
      seen.push(new Request(input, init));
      return response(me);
    },
  });
  const client = createApiClient({
    baseUrl: 'https://api.example.test',
    session: sessionApi,
    fetcher: async (input, init) => {
      seen.push(new Request(input, init));
      return response({ ok: true });
    },
  });

  await sessionApi.acceptSession({ ...valid, accessToken: 'accepted-new' });
  await client.request('/v1/houses');

  expect(seen.at(-1)?.headers.get('authorization')).toBe('Bearer accepted-new');
  expect(await authority.getAccessToken()).toBe('accepted-new');
});

test('logout invalidates delayed bootstrap refresh and clears persisted credentials', async () => {
  const expired = { ...valid, expiresAt: '2020-01-01T00:00:00Z' };
  const credentials = store(expired);
  const refreshResponse = deferred<Response>();
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  const requests: Request[] = [];
  const sessionApi = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.url.endsWith('/refresh')) return refreshResponse.promise;
      return response(me);
    },
  });

  const bootstrap = sessionApi.bootstrap();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await sessionApi.logout();
  expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
    '/v1/auth/refresh',
    '/v1/auth/logout',
  ]);
  refreshResponse.resolve(response({ ...valid, accessToken: 'resurrected' }));

  await expect(bootstrap).rejects.toThrow(/Session changed/);
  expect(credentials.value).toBeNull();
  expect(await authority.getAccessToken()).toBeNull();
});

test('expired session refreshes once with idempotency and persists before me', async () => {
  const expired = { ...valid, expiresAt: '2020-01-01T00:00:00Z' };
  const credentials = store(expired);
  const requests: Request[] = [];
  const rotated = { ...valid, accessToken: 'rotated', refreshToken: 'rotated-refresh' };
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  const api = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    createIdempotencyKey: () => requestId,
    fetcher: async (input, init) => {
      requests.push(new Request(input, init));
      return requests.at(-1)?.url.endsWith('/refresh') ? response(rotated) : response(me);
    },
  });
  await authority.getAccessToken();
  expect(await api.bootstrap()).toEqual(me);
  expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
    '/v1/auth/refresh',
    '/v1/me',
  ]);
  expect(requests[0]?.headers.get('idempotency-key')).toBe(requestId);
  expect(credentials.value?.refreshToken).toBe('rotated-refresh');
});
