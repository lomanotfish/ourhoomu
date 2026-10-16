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
  const authority = createSessionAuthority({
    baseUrl: 'https://api.example.test',
    credentials,
    fetcher: async () => new Response(null, { status: 401 }),
    onAuthenticatedCacheClear: () => {
      cacheClears++;
    },
  });
  const api = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    fetcher: async () =>
      new Response(
        JSON.stringify({
          error: { code: 'unauthenticated', message: 'No session' },
          requestId,
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    onAuthenticatedCacheClear: () => {
      cacheClears++;
    },
  });
  await expect(api.bootstrap()).rejects.toBeInstanceOf(ApiHttpError);
  expect(credentials.value).toBeNull();
  expect(credentials.clears).toBe(1);
  expect(cacheClears).toBe(1);
});

test('bootstrap refreshes through the canonical authority with one shared flight and stable replay body', async () => {
  const expired = { ...valid, expiresAt: '2020-01-01T00:00:00Z' };
  const credentials = store(expired);
  const first = deferred<Response>();
  const retryStarted = deferred<void>();
  const bootstrapsStarted = deferred<void>();
  const requests: Request[] = [];
  let keys = 0;
  let calls = 0;
  const rotated = { ...valid, accessToken: 'rotated', refreshToken: 'rotated-refresh' };
  const authority = createSessionAuthority({
    baseUrl: 'https://api.example.test',
    credentials,
    now: () => Date.parse('2020-01-01T00:00:00Z'),
    createIdempotencyKey: () => `authority-${++keys}`,
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.url.endsWith('/auth/refresh')) {
        calls++;
        if (calls === 1) throw new TypeError('lost response after rotation');
        retryStarted.resolve();
        return first.promise;
      }
      return response(me);
    },
  });
  const sessionApi = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    createIdempotencyKey: () => {
      throw new Error('bootstrap must not construct a second refresh key');
    },
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return request.headers.get('authorization') === 'Bearer rotated'
        ? response(me)
        : response({ error: { code: 'unauthenticated', message: 'Expired' }, requestId }, 401);
    },
  });

  const bootstraps = [sessionApi.bootstrap(), sessionApi.bootstrap(), sessionApi.bootstrap()];
  bootstrapsStarted.resolve();
  await bootstrapsStarted.promise;
  await retryStarted.promise;
  first.resolve(response(rotated));
  await expect(Promise.all(bootstraps)).resolves.toEqual([me, me, me]);

  const refreshRequests = requests.filter((request) => request.url.endsWith('/auth/refresh'));
  expect(keys).toBe(1);
  expect(refreshRequests).toHaveLength(2);
  expect(refreshRequests.map((request) => request.headers.get('idempotency-key'))).toEqual([
    'authority-1',
    'authority-1',
  ]);
  expect(await refreshRequests[0]!.clone().text()).toBe(await refreshRequests[1]!.clone().text());
  expect(requests.filter((request) => request.url.endsWith('/me'))).toHaveLength(6);
  expect(calls).toBe(2);
  expect(credentials.value).toEqual(rotated);
});

test('terminal bootstrap 401 cannot clear an identity accepted while its response was pending', async () => {
  const credentials = store();
  const responseWaiter = deferred<Response>();
  const started = deferred<void>();
  const accepted = {
    ...valid,
    accessToken: 'new-identity',
    userId: '550e8400-e29b-41d4-a716-446655440002',
  };
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  const api = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    fetcher: async () => {
      started.resolve();
      return responseWaiter.promise;
    },
  });
  const bootstrap = api.bootstrap();
  await started.promise;
  await authority.replaceSession(accepted);
  responseWaiter.resolve(
    response({ error: { code: 'unauthenticated', message: 'Expired' }, requestId }, 401),
  );
  await expect(bootstrap).rejects.toBeInstanceOf(ApiHttpError);
  expect(credentials.value).toEqual(accepted);
  expect(await authority.getAccessToken()).toBe(accepted.accessToken);
});

test('logout invalidates locally before a stalled remote revoke and late revoke leaves a new identity intact', async () => {
  const credentials = store();
  const remoteRevoke = deferred<Response>();
  const revokeStarted = deferred<Request>();
  const accepted = {
    ...valid,
    accessToken: 'accepted-after-logout',
    refreshToken: 'new-refresh',
    userId: '550e8400-e29b-41d4-a716-446655440002',
  };
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  const api = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      if (request.url.endsWith('/logout')) {
        revokeStarted.resolve(request);
        return remoteRevoke.promise;
      }
      return response(me);
    },
  });
  const logout = api.logout();
  const revoke = await revokeStarted.promise;
  expect(revoke.headers.get('authorization')).toBe('Bearer access');
  expect(await authority.getAccessToken()).toBeNull();
  expect(credentials.value).toBeNull();
  await authority.replaceSession(accepted);
  remoteRevoke.resolve(response({ revoked: true }));
  await logout;
  expect(credentials.value).toEqual(accepted);
  expect(await authority.getAccessToken()).toBe(accepted.accessToken);
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
  const authority = createSessionAuthority({
    baseUrl: 'https://api.example.test',
    credentials,
    now: () => Date.parse('2020-01-02T00:00:00Z'),
    fetcher: async () => refreshResponse.promise,
  });
  const requests: Request[] = [];
  const refreshStarted = deferred<void>();
  const sessionApi = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.url.endsWith('/me')) refreshStarted.resolve();
      return response(me);
    },
  });
  const bootstrap = sessionApi.bootstrap();
  await refreshStarted.promise;
  await sessionApi.logout();
  expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
    '/v1/me',
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
  const authority = createSessionAuthority({
    baseUrl: 'https://api.example.test',
    credentials,
    now: () => Date.parse('2020-01-02T00:00:00Z'),
    createIdempotencyKey: () => requestId,
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      expect(request.headers.get('idempotency-key')).toBe(requestId);
      return Response.json({ data: rotated, requestId });
    },
  });
  const api = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return request.headers.get('authorization') === 'Bearer access'
        ? response({ error: { code: 'unauthenticated', message: 'Expired' }, requestId }, 401)
        : response(me);
    },
  });
  await expect(api.bootstrap()).resolves.toEqual(me);
  expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
    '/v1/me',
    '/v1/auth/refresh',
    '/v1/me',
  ]);
  expect(credentials.value?.refreshToken).toBe('rotated-refresh');
});
