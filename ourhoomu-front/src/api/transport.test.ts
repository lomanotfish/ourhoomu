import { describe, expect, test } from 'bun:test';
import { ApiHttpError, ApiProtocolError, OfflineMutationError } from './errors';
import { createApiClient, type SessionTransport } from './client';

const success = (data: unknown) =>
  Response.json({ data, requestId: '550e8400-e29b-41d4-a716-446655440040' }, { status: 200 });

const error = (
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
  headers?: HeadersInit,
) =>
  new Response(
    JSON.stringify({
      error: { code, message: 'Request rejected', ...extra },
      requestId: '550e8400-e29b-41d4-a716-446655440041',
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(headers)) },
    },
  );

const session: SessionTransport = {
  getAccessToken: async () => 'access-1',
  refreshAfterUnauthorized: async () => 'access-2',
};

describe('API transport', () => {
  test('returns typed envelope data and controls bearer authorization', async () => {
    let captured: Request | undefined;
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      session,
      fetcher: async (input, init) => {
        captured = new Request(input, init);
        return success({ id: 'house-1' });
      },
    });

    const result = await client.request<{ id: string }>('/v1/me');
    expect(result).toEqual({ id: 'house-1' });
    expect(captured?.headers.get('Authorization')).toBe('Bearer access-1');
  });

  test('requires HTTPS except for explicitly opted-in loopback development', () => {
    expect(() => createApiClient({ baseUrl: 'http://api.example.test', session })).toThrow(/HTTPS/);
    expect(() => createApiClient({ baseUrl: 'http://localhost:8787', session })).toThrow(
      /opted-in/,
    );
    expect(() =>
      createApiClient({
        baseUrl: 'http://127.0.0.1:8787',
        session,
        allowDevelopmentLoopback: true,
      }),
    ).not.toThrow();
  });

  test('blocks offline mutations before fetch', async () => {
    let calls = 0;
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      session,
      isOnline: () => false,
      fetcher: async () => {
        calls += 1;
        return success(null);
      },
    });

    await expect(
      client.request('/v1/houses', {
        method: 'POST',
        body: { name: 'Home' },
        idempotencyKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(OfflineMutationError);
    expect(calls).toBe(0);
  });

  test('does not allow request bodies to select an authenticated actor', async () => {
    let calls = 0;
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      session,
      fetcher: async () => {
        calls += 1;
        return success(null);
      },
    });

    await expect(
      client.request('/v1/me', { method: 'POST', body: { actor: 'user-b' } }),
    ).rejects.toThrow(/cannot choose authenticated actor/);
    expect(calls).toBe(0);
  });

  test('passes caller cancellation through to fetch and does not refresh after abort', async () => {
    const controller = new AbortController();
    let refreshes = 0;
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      session: {
        getAccessToken: async () => 'access-1',
        refreshAfterUnauthorized: async () => {
          refreshes += 1;
          return 'access-2';
        },
      },
      fetcher: async (_input, init) => {
        expect(init?.signal).toBe(controller.signal);
        return error(401, 'unauthenticated');
      },
    });

    const request = client.request('/v1/me', { signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(refreshes).toBe(0);
  });

  test('replays once after refresh with the exact JSON body and caller key', async () => {
    const seen: Request[] = [];
    let refreshCalls = 0;
    const transport: SessionTransport = {
      getAccessToken: async () => 'access-1',
      refreshAfterUnauthorized: async () => {
        refreshCalls += 1;
        return 'access-2';
      },
    };
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      session: transport,
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        seen.push(request);
        return seen.length === 1 ? error(401, 'unauthenticated') : success({ saved: true });
      },
    });

    await expect(
      client.request('/v1/houses', {
        method: 'POST',
        body: { name: 'Home', expectedVersion: 2 },
        idempotencyKey: 'caller-key',
      }),
    ).resolves.toEqual({ saved: true });
    expect(refreshCalls).toBe(1);
    expect(await seen[0]!.text()).toBe(await seen[1]!.text());
    expect(seen.map((request) => request.headers.get('Idempotency-Key'))).toEqual([
      'caller-key',
      'caller-key',
    ]);
    expect(seen.map((request) => request.headers.get('Authorization'))).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
    expect(seen.every((request) => request.redirect === 'error')).toBe(true);
  });

  test('does not replay an unkeyed mutation or recurse after a second 401', async () => {
    let calls = 0;
    let refreshes = 0;
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      session: {
        getAccessToken: async () => 'access-1',
        refreshAfterUnauthorized: async () => {
          refreshes += 1;
          return 'access-2';
        },
      },
      fetcher: async () => {
        calls += 1;
        return error(401, 'unauthenticated');
      },
    });

    await expect(
      client.request('/v1/houses', { method: 'POST', body: { name: 'Home' } }),
    ).rejects.toBeInstanceOf(ApiHttpError);
    expect(calls).toBe(1);
    expect(refreshes).toBe(0);
  });

  test('retains typed 403, 404, 409, 410, and 429 details', async () => {
    for (const [status, code, extra, retryAfter] of [
      [403, 'forbidden', {}, null],
      [404, 'not_found', {}, null],
      [409, 'version_conflict', { currentVersion: 3 }, null],
      [410, 'expired', {}, null],
      [429, 'rate_limited', {}, '12'],
    ] as const) {
      const client = createApiClient({
        baseUrl: 'https://api.example.test',
        session,
        fetcher: async () =>
          error(status, code, extra, retryAfter ? { 'Retry-After': retryAfter } : undefined),
      });
      try {
        await client.request('/v1/me');
        throw new Error('expected request rejection');
      } catch (caught) {
        expect(caught).toBeInstanceOf(ApiHttpError);
        const apiError = caught as ApiHttpError;
        expect(apiError.status).toBe(status);
        expect(apiError.code).toBe(code);
        expect(apiError.currentVersion).toBe(status === 409 ? 3 : undefined);
        expect(apiError.retryAfter).toBe(retryAfter);
        expect(apiError.requestId).toBe('550e8400-e29b-41d4-a716-446655440041');
      }
    }
  });

  test('rejects malformed success and error envelopes', async () => {
    const malformedSuccess = createApiClient({
      baseUrl: 'https://api.example.test',
      session,
      fetcher: async () => Response.json({ unexpected: true }),
    });
    await expect(malformedSuccess.request('/v1/me')).rejects.toBeInstanceOf(ApiProtocolError);

    const malformedError = createApiClient({
      baseUrl: 'https://api.example.test',
      session,
      fetcher: async () =>
        Response.json({ error: { code: 'version_conflict', message: 'stale' } }, { status: 409 }),
    });
    await expect(malformedError.request('/v1/me')).rejects.toBeInstanceOf(ApiProtocolError);
  });

  test('rejects missing, malformed, or extra error envelope properties', async () => {
    for (const payload of [
      { error: { code: 'forbidden', message: 'Denied' } },
      {
        error: { code: 'forbidden', message: 'Denied' },
        requestId: 'not-a-uuid',
      },
      {
        error: { code: 'forbidden', message: 'Denied', extra: true },
        requestId: '550e8400-e29b-41d4-a716-446655440042',
      },
    ]) {
      const client = createApiClient({
        baseUrl: 'https://api.example.test',
        session,
        fetcher: async () => Response.json(payload, { status: 403 }),
      });
      await expect(client.request('/v1/me')).rejects.toBeInstanceOf(ApiProtocolError);
    }
  });

  test('disables redirects on initial API requests', async () => {
    let captured: Request | undefined;
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      session,
      fetcher: async (input, init) => {
        captured = new Request(input, init);
        return success({ ok: true });
      },
    });

    await client.request('/v1/me');
    expect(captured?.redirect).toBe('error');
  });
});
