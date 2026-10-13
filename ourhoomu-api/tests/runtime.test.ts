import { describe, expect, it } from 'bun:test';
import { createApp } from '../src/app';

describe('runtime envelope', () => {
  const app = createApp({ appEnv: 'test', allowedOrigin: 'http://localhost:8081' });

  it('returns health with the common success envelope', async () => {
    const response = await app.fetch(new Request('https://api.test/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: 'ok' } });
  });

  it('rejects invalid request bodies with the common 400 error envelope', async () => {
    const response = await app.fetch(new Request('https://api.test/runtime/validate', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer fixture' }, body: JSON.stringify({ value: '' }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'validation_error' } });
  });

  it('rejects a missing credential with 401', async () => {
    const response = await app.fetch(new Request('https://api.test/runtime/validate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'ok' }),
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'unauthenticated' } });
  });
});
