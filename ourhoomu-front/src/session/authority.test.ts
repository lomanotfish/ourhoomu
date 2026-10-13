import { describe, expect, test } from 'bun:test';
import { createSessionAuthority, type CredentialStore, type Session } from './authority';
import { createApiClient } from '../api/client';

const original: Session = {
  accessToken: 'access-old',
  refreshToken: 'refresh-old',
  expiresAt: '2026-10-14T12:00:00Z',
  userId: '550e8400-e29b-41d4-a716-446655440001',
};

const rotated: Session = {
  accessToken: 'access-new',
  refreshToken: 'refresh-new',
  expiresAt: '2026-10-14T13:00:00Z',
  userId: '550e8400-e29b-41d4-a716-446655440001',
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
  return Response.json({
    data: session,
    requestId: '550e8400-e29b-41d4-a716-446655440030',
  });
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
    expect(requests.every((request) => request.redirect === 'error')).toBe(true);
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
    const replacement: Session = {
      ...original,
      userId: '550e8400-e29b-41d4-a716-446655440002',
      accessToken: 'access-b',
    };
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
          {
            error: { code: 'unauthenticated', message: 'Invalid session' },
            requestId: '550e8400-e29b-41d4-a716-446655440031',
          },
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

  test('does not replay a late unauthorized mutation after account replacement', async () => {
    const store = memoryStore();
    const first = deferred<Response>();
    const started = deferred<void>();
    const replacement: Session = {
      ...rotated,
      accessToken: 'access-b',
      refreshToken: 'refresh-b',
      userId: '550e8400-e29b-41d4-a716-446655440002',
    };
    const authorities = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
      fetcher: async () => refreshSuccess(rotated),
    });
    const seen: Request[] = [];
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      session: authorities,
      fetcher: async (input, init) => {
        seen.push(new Request(input, init));
        if (seen.length === 1) {
          started.resolve();
          return first.promise;
        }
        return successResponse({ saved: true });
      },
    });

    const pending = client.request('/v1/houses', {
      method: 'POST',
      body: { name: 'old-account-draft' },
      idempotencyKey: 'mutation-key',
    });
    await started.promise;
    await authorities.replaceSession(replacement);
    first.resolve(
      Response.json(
        {
          error: { code: 'unauthenticated', message: 'Expired' },
          requestId: '550e8400-e29b-41d4-a716-446655440010',
        },
        { status: 401 },
      ),
    );

    await expect(pending).rejects.toMatchObject({ name: 'ApiHttpError', status: 401 });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer access-old');
  });

  test('allows a late unauthorized response after a same-session rotation', async () => {
    const store = memoryStore();
    const first = deferred<Response>();
    const started = deferred<void>();
    let refreshes = 0;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
      fetcher: async () => {
        refreshes += 1;
        return refreshSuccess(rotated);
      },
    });
    const seen: Request[] = [];
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      session: authority,
      fetcher: async (input, init) => {
        seen.push(new Request(input, init));
        if (seen.length === 1) {
          started.resolve();
          return first.promise;
        }
        return successResponse({ saved: true });
      },
    });

    const pending = client.request('/v1/houses', {
      method: 'POST',
      body: { name: 'same-account-draft' },
      idempotencyKey: 'mutation-key',
    });
    await started.promise;
    await expect(authority.refreshAfterUnauthorized('access-old')).resolves.toBe('access-new');
    first.resolve(
      Response.json(
        {
          error: { code: 'unauthenticated', message: 'Expired' },
          requestId: '550e8400-e29b-41d4-a716-446655440011',
        },
        { status: 401 },
      ),
    );

    await expect(pending).resolves.toEqual({ saved: true });
    expect(refreshes).toBe(1);
    expect(seen.map((request) => request.headers.get('Authorization'))).toEqual([
      'Bearer access-old',
      'Bearer access-new',
    ]);
  });

  test('does not treat logout and same-user relogin as a token rotation', async () => {
    const store = memoryStore();
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
    });
    const requestRevision = authority.getSessionRevision();

    await authority.logout();
    await authority.replaceSession({ ...original, accessToken: 'access-relogin' });

    await expect(
      authority.refreshAfterUnauthorized('access-old', undefined, requestRevision),
    ).resolves.toBeNull();
  });

  test('keeps a delayed credential read from escaping completed logout', async () => {
    const store = memoryStore();
    const loaded = deferred<Session | null>();
    store.load = () => loaded.promise;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
    });

    const token = authority.getAccessToken();
    await authority.logout();
    loaded.resolve(original);

    await expect(token).resolves.toBeNull();
    expect(store.value).toBeNull();
  });

  test('does not expose old credentials while replacement save is pending', async () => {
    const store = memoryStore();
    const save = deferred<void>();
    const replacement = { ...rotated, accessToken: 'access-b' };
    store.save = async (session) => {
      await save.promise;
      store.value = session;
    };
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
    });

    const replacing = authority.replaceSession(replacement);
    const token = authority.getAccessToken();
    save.resolve();
    await replacing;

    await expect(token).resolves.toBe('access-b');
  });

  test('does not expose credentials while logout clear is pending', async () => {
    const store = memoryStore();
    const clear = deferred<void>();
    store.clear = async () => {
      await clear.promise;
      store.value = null;
    };
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
    });

    const loggingOut = authority.logout();
    const token = authority.getAccessToken();
    clear.resolve();
    await loggingOut;

    await expect(token).resolves.toBeNull();
  });

  test('logout invoked after replacement wins over its delayed storage read', async () => {
    const store = memoryStore();
    const loaded = deferred<Session | null>();
    store.load = () => loaded.promise;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
    });
    const replacement = { ...rotated, accessToken: 'access-b' };

    const pendingReplacement = authority.replaceSession(replacement);
    const logout = authority.logout();
    loaded.resolve(original);
    await Promise.all([pendingReplacement, logout]);

    expect(store.value).toBeNull();
  });

  test('does not refresh from a delayed pre-rotation storage snapshot', async () => {
    const store = memoryStore();
    const load = deferred<Session | null>();
    let delayNext = false;
    store.load = async () => {
      if (delayNext) {
        delayNext = false;
        return load.promise;
      }
      return store.value;
    };
    let refreshes = 0;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
      fetcher: async () => {
        refreshes += 1;
        return refreshSuccess(rotated);
      },
    });

    await expect(authority.refreshAfterUnauthorized('access-old')).resolves.toBe('access-new');
    delayNext = true;
    const delayed = authority.refreshAfterUnauthorized('access-old');
    load.resolve(original);
    await expect(delayed).resolves.toBe('access-new');

    expect(refreshes).toBe(1);
    expect(store.value).toEqual(rotated);
  });

  test('recovers an uncertain refresh with its original key and body within five minutes', async () => {
    const store = memoryStore();
    const requests: Request[] = [];
    let now = 1_000;
    let call = 0;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
      now: () => now,
      createIdempotencyKey: (() => {
        let next = 0;
        return () => `refresh-key-${++next}`;
      })(),
      fetcher: async (input, init) => {
        requests.push(new Request(input, init));
        call += 1;
        if (call <= 2) throw new TypeError('lost response');
        return refreshSuccess(rotated);
      },
    });

    await expect(authority.refreshAfterUnauthorized('access-old')).rejects.toThrow('lost response');
    await expect(authority.refreshAfterUnauthorized('access-old')).resolves.toBe('access-new');
    expect(requests).toHaveLength(3);
    expect(requests.map((request) => request.headers.get('Idempotency-Key'))).toEqual([
      'refresh-key-1',
      'refresh-key-1',
      'refresh-key-1',
    ]);
    expect(await requests[0]!.text()).toBe(await requests[2]!.text());
    now += 5 * 60 * 1000 + 1;
    await expect(authority.refreshAfterUnauthorized('access-new')).resolves.toBe('access-new');
  });

  test('fails closed when an uncertain refresh is older than five minutes', async () => {
    const store = memoryStore();
    let now = 1_000;
    let calls = 0;
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
      now: () => now,
      fetcher: async () => {
        calls += 1;
        throw new TypeError('lost response');
      },
    });

    await expect(authority.refreshAfterUnauthorized('access-old')).rejects.toThrow('lost response');
    now += 5 * 60 * 1000 + 1;
    await expect(authority.refreshAfterUnauthorized('access-old')).resolves.toBeNull();
    expect(calls).toBe(2);
    expect(store.value).toBeNull();
  });

  test('rejects refresh envelopes without a valid request id or with extra session fields', async () => {
    for (const payload of [
      { data: rotated },
      {
        data: rotated,
        requestId: 'not-a-uuid',
      },
      {
        data: { ...rotated, unexpected: true },
        requestId: '550e8400-e29b-41d4-a716-446655440050',
      },
      {
        data: { ...rotated, userId: 'not-a-uuid' },
        requestId: '550e8400-e29b-41d4-a716-446655440051',
      },
      {
        data: { ...rotated, expiresAt: 'not-a-date' },
        requestId: '550e8400-e29b-41d4-a716-446655440052',
      },
      {
        data: { ...rotated, accessToken: 123 },
        requestId: '550e8400-e29b-41d4-a716-446655440053',
      },
    ]) {
      const store = memoryStore();
      const authority = createSessionAuthority({
        baseUrl: 'https://api.example.test',
        credentials: store,
        fetcher: async () => Response.json(payload),
      });

      await expect(authority.refreshAfterUnauthorized('access-old')).rejects.toMatchObject({
        name: 'ApiProtocolError',
      });
      expect(store.value).toEqual(original);
    }
  });

  test('rejects refresh error envelopes without request ids', async () => {
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: memoryStore(),
      fetcher: async () =>
        Response.json({ error: { code: 'forbidden', message: 'Denied' } }, { status: 403 }),
    });

    await expect(authority.refreshAfterUnauthorized('access-old')).rejects.toMatchObject({
      name: 'ApiProtocolError',
    });
  });

  test('prevents a real loopback 307 from forwarding the refresh credential body', async () => {
    let receivedBody: string | null = null;
    const sink = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: async (request) => {
        receivedBody = await request.text();
        return refreshSuccess(rotated);
      },
    });
    const redirector = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: () =>
        new Response(null, {
          status: 307,
          headers: { Location: `http://127.0.0.1:${sink.port}/capture` },
        }),
    });
    try {
      const authority = createSessionAuthority({
        baseUrl: `http://127.0.0.1:${redirector.port}`,
        allowDevelopmentLoopback: true,
        credentials: memoryStore(),
      });

      await expect(authority.refreshAfterUnauthorized('access-old')).rejects.toBeInstanceOf(
        TypeError,
      );
      expect(receivedBody).toBeNull();
    } finally {
      redirector.stop(true);
      sink.stop(true);
    }
  });
});

const successResponse = (data: unknown) =>
  Response.json({ data, requestId: '550e8400-e29b-41d4-a716-446655440020' });
