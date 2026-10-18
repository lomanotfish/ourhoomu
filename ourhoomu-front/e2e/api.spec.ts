import { expect, test } from '@playwright/test';

const origin = 'http://localhost:18047';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('actual workerd health envelope and unique request IDs', async ({ request }) => {
  const first = await request.get('/health', { headers: { Origin: origin } });
  expect(first.status()).toBe(200);
  expect(first.headers()['content-type']).toContain('application/json');
  const body = await first.json();
  expect(body).toEqual({ data: { status: 'ok' }, requestId: expect.stringMatching(uuid) });
  expect(first.headers()['x-request-id']).toBe(body.requestId);
  expect(first.headers()['access-control-allow-origin']).toBe(origin);
  const second = await request.get('/health');
  expect((await second.json()).requestId).not.toBe(body.requestId);
});

test('unknown route has safe error envelope and CORS', async ({ request }) => {
  const response = await request.get('/e2e-missing-route', { headers: { Origin: origin } });
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: 'not_found', message: 'Not found' },
    requestId: expect.stringMatching(uuid),
  });
  expect(response.headers()['access-control-allow-origin']).toBe(origin);
});

test('preflight permits contract headers and never reflects hostile origins', async ({
  request,
}) => {
  for (const incoming of [origin, 'https://untrusted.invalid']) {
    const response = await request.fetch('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: incoming,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type,idempotency-key',
      },
    });
    expect(response.status()).toBe(204);
    expect(await response.text()).toBe('');
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBe(origin);
    expect(headers['access-control-allow-methods'].split(',')).toEqual([
      'GET',
      'POST',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ]);
    expect(headers['access-control-allow-headers'].split(',')).toEqual([
      'authorization',
      'content-type',
      'idempotency-key',
    ]);
    expect(headers['access-control-expose-headers']).toBe('retry-after,x-request-id');
    expect(headers['access-control-max-age']).toBe('600');
    expect(headers['access-control-allow-credentials']).toBeUndefined();
  }
});

test('production entrypoint does not expose fixture proof routes', async ({ request }) => {
  const response = await request.post('/runtime/validate', {
    headers: { Authorization: 'Bearer arbitrary-e2e-value' },
    data: { value: 'ok' },
  });
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: 'not_found', message: 'Not found' },
    requestId: expect.stringMatching(uuid),
  });
});
