import { describe, expect, it } from 'bun:test';
import { createApp } from '../src/app';

describe('runtime envelope', () => {
  const app = createApp({ appEnv: 'test', allowedOrigin: 'http://localhost:8081' });

  it('returns health with the common success envelope', async () => {
    const response = await app.fetch(new Request('https://api.test/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: 'ok' } });
  });

  it('does not expose the test validation route from the production app', async () => {
    const response = await app.fetch(new Request('https://api.test/runtime/validate', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer arbitrary' }, body: JSON.stringify({ value: 'ok' }),
    }));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'not_found', message: 'Not found' } });
  });

  it('returns a fixed 404 for an unknown route', async () => {
    const response = await app.fetch(new Request('https://api.test/not-a-route'));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'not_found', message: 'Not found' } });
  });
});
