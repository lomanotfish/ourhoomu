import { describe, expect, test } from 'bun:test';
import { createSessionAuthority, type CredentialStore, type Session } from './authority';

const original: Session = {
  accessToken: 'access-old',
  refreshToken: 'refresh-old',
  expiresAt: '2026-10-14T12:00:00Z',
  userId: 'user-a',
};

const rotated: Session = {
  accessToken: 'access-new',
  refreshToken: 'refresh-new',
  expiresAt: '2026-10-14T13:00:00Z',
  userId: 'user-a',
};

function memoryStore(
  initial: Session | null = original,
): CredentialStore & { value: Session | null } {
  return {
    value: initial,
    async load() {
      return this.value;
    },
    async save(session) {
      this.value = session;
    },
    async clear() {
      this.value = null;
    },
  };
}

function refreshSuccess(session: Session): Response {
  return Response.json({ data: session, requestId: 'refresh-request' });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('session authority', () => {
  test('serializes concurrent unauthorized responses into one refresh', async () => {
    const store = memoryStore();
    const response = deferred<Response>();
    let calls = 0;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
      createIdempotencyKey: () => 'refresh-key',
      fetcher: async () => {
        calls += 1;
        return response.promise;
      },
    });

    const first = authority.refreshAfterUnauthorized('access-old');
    const second = authority.refreshAfterUnauthorized('access-old');
    response.resolve(refreshSuccess(rotated));
    await expect(Promise.all([first, second])).resolves.toEqual(['access-new', 'access-new']);
    expect(calls).toBe(1);
    expect(store.value).toEqual(rotated);
  });

  test('retries a transient refresh failure with the exact same key and body', async () => {
    const store = memoryStore();
    const requests: Request[] = [];
    let calls = 0;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
      createIdempotencyKey: () => 'stable-refresh-key',
      fetcher: async (input, init) => {
        calls += 1;
        requests.push(new Request(input, init));
        if (calls === 1) throw new TypeError('temporary network failure');
        return refreshSuccess(rotated);
      },
    });

    await expect(authority.refreshAfterUnauthorized('access-old')).resolves.toBe('access-new');
    expect(calls).toBe(2);
    expect(await requests[0]!.text()).toBe(await requests[1]!.text());
    expect(requests.map((request) => request.headers.get('Idempotency-Key'))).toEqual([
      'stable-refresh-key',
      'stable-refresh-key',
    ]);
  });

  test('logout wins over an in-flight refresh and clears the authenticated cache', async () => {
    const store = memoryStore();
    const pending = deferred<Response>();
    let cacheClears = 0;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
      onAuthenticatedCacheClear: () => {
        cacheClears += 1;
      },
      fetcher: async () => pending.promise,
    });

    const refreshing = authority.refreshAfterUnauthorized('access-old');
    await authority.logout();
    pending.resolve(refreshSuccess(rotated));
    await expect(refreshing).resolves.toBeNull();
    expect(store.value).toBeNull();
    expect(cacheClears).toBe(1);
  });

  test('account replacement discards a refresh from the previous generation', async () => {
    const store = memoryStore();
    const pending = deferred<Response>();
    const replacement: Session = { ...original, userId: 'user-b', accessToken: 'access-b' };
    let cacheClears = 0;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
      onAuthenticatedCacheClear: () => {
        cacheClears += 1;
      },
      fetcher: async () => pending.promise,
    });

    const refreshing = authority.refreshAfterUnauthorized('access-old');
    await authority.replaceSession(replacement);
    pending.resolve(refreshSuccess(rotated));
    await expect(refreshing).resolves.toBeNull();
    expect(store.value).toEqual(replacement);
    expect(cacheClears).toBe(1);
  });

  test('terminal refresh 401 clears credentials and authenticated cache', async () => {
    const store = memoryStore();
    let cacheClears = 0;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
      onAuthenticatedCacheClear: () => {
        cacheClears += 1;
      },
      fetcher: async () =>
        Response.json(
          { error: { code: 'unauthenticated', message: 'Invalid session' }, requestId: 'failed' },
          { status: 401 },
        ),
    });

    await expect(authority.refreshAfterUnauthorized('access-old')).resolves.toBeNull();
    expect(store.value).toBeNull();
    expect(cacheClears).toBe(1);
  });

  test('requires explicit loopback opt-in and does not use insecure remote URLs', () => {
    expect(() =>
      createSessionAuthority({ baseUrl: 'http://example.test', credentials: memoryStore() }),
    ).toThrow(/HTTPS/);
    expect(() =>
      createSessionAuthority({
        baseUrl: 'http://localhost:8787',
        credentials: memoryStore(),
        allowDevelopmentLoopback: true,
      }),
    ).not.toThrow();
  });
});
