import { describe, expect, it } from 'bun:test';
import { createApp } from '../src/app';

type JsonBody = {
  requestId?: unknown;
  data?: { status?: string };
  error?: { code?: string; message?: string };
};

describe('runtime envelope', () => {
  const app = createApp({ appEnv: 'test', allowedOrigin: 'http://localhost:8081' });

  it('returns health with the common success envelope', async () => {
    const response = await app.fetch(new Request('https://api.test/health'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as JsonBody;
    expect(body).toMatchObject({ data: { status: 'ok' } });
    expect(typeof body.requestId).toBe('string');
    expect(response.headers.get('x-request-id')).toBe(body.requestId as string);
  });

  it('does not expose the test validation route from the production app', async () => {
    const response = await app.fetch(
      new Request('https://api.test/runtime/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer arbitrary' },
        body: JSON.stringify({ value: 'ok' }),
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: 'not_found', message: 'Not found' },
    });
  });

  it('returns a fixed 404 for an unknown route', async () => {
    const response = await app.fetch(new Request('https://api.test/not-a-route'));
    expect(response.status).toBe(404);
    const body = (await response.json()) as JsonBody;
    expect(body).toMatchObject({
      error: { code: 'not_found', message: 'Not found' },
    });
    expect(typeof body.requestId).toBe('string');
  });

  it('uses exact runtime error status mappings, not merely any client error', async () => {
    const wrongStatus = async (path: string, init?: RequestInit) => {
      const response = await app.fetch(new Request(`https://api.test${path}`, init));
      const body = (await response.json()) as JsonBody;
      return { status: response.status, code: body.error?.code };
    };
    expect(await wrongStatus('/not-a-route')).toEqual({ status: 404, code: 'not_found' });
  });

  it('allows the contract mutation methods and idempotency header in preflight', async () => {
    const response = await app.fetch(
      new Request('https://api.test/v1/houses/fixture', {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:8081',
          'access-control-request-method': 'PATCH',
          'access-control-request-headers': 'authorization,content-type,idempotency-key',
        },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    const methods = response.headers.get('access-control-allow-methods')?.split(',');
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'])
      expect(methods).toContain(method);
    expect(response.headers.get('access-control-allow-headers')?.split(',')).toContain(
      'idempotency-key',
    );
  });

  it('exposes retry and request identifiers to the configured web frontend', async () => {
    const response = await app.fetch(new Request('https://api.test/health'));
    const exposed = response.headers.get('access-control-expose-headers')?.split(',') ?? [];
    expect(exposed).toContain('retry-after');
    expect(exposed).toContain('x-request-id');
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
  });
});
