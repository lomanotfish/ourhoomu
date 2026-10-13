import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import type { AppConfig } from './config';

export function createApp(config: AppConfig) {
  return new Elysia({ adapter: CloudflareAdapter })
    .onRequest(({ request, set }) => {
      set.headers['access-control-allow-origin'] = config.allowedOrigin;
      set.headers['access-control-allow-methods'] = 'GET,POST,OPTIONS';
      set.headers['access-control-allow-headers'] = 'authorization,content-type';
      set.headers['access-control-max-age'] = '600';
    })
    .derive(({ set }) => {
      const requestId = crypto.randomUUID();
      set.headers['x-request-id'] = requestId;
      return { requestId };
    })
    .options('*', ({ set }) => {
      set.status = 204;
      return null;
    })
    .get('/health', ({ requestId }) => ({
      data: { status: 'ok' },
      requestId,
    }))
    .post('/runtime/validate', async ({ request, requestId, set }) => {
        if (!request.headers.get('authorization')) {
          set.status = 401;
          return { error: { code: 'unauthenticated', message: 'Authentication required' }, requestId };
        }
        let parsed: unknown;
        try { parsed = await request.json(); } catch {
          set.status = 400;
          return { error: { code: 'validation_error', message: 'Request validation failed' }, requestId };
        }
        const value = parsed && typeof parsed === 'object' && 'value' in parsed ? parsed.value : undefined;
        if (typeof value !== 'string' || value.length < 1 || value.length > 32) {
          set.status = 400;
          return { error: { code: 'validation_error', message: 'Request validation failed' }, requestId };
        }
        return { data: { accepted: true, value }, requestId };
      })
    .onError(({ code, error, requestId, set }) => {
      requestId ??= crypto.randomUUID();
      if (code === 'VALIDATION' || code === 'PARSE' || (error && typeof error === 'object' && 'status' in error && error.status === 422)) {
        set.status = 400;
        return { error: { code: 'validation_error', message: 'Request validation failed' }, requestId };
      }
      set.status = 500;
      return { error: { code: 'internal_error', message: error instanceof Error ? error.message : 'Internal error' }, requestId };
    })
    .compile();
}
