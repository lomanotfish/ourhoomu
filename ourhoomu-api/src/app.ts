import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import type { AppConfig } from './config';

export function createApp(config: AppConfig) {
  return new Elysia({ adapter: CloudflareAdapter })
    .onRequest(({ set }) => {
      set.headers['access-control-allow-origin'] = config.allowedOrigin;
      set.headers['access-control-allow-methods'] = 'GET,POST,PATCH,DELETE,OPTIONS';
      set.headers['access-control-allow-headers'] = 'authorization,content-type,idempotency-key';
      set.headers['access-control-expose-headers'] = 'retry-after,x-request-id';
      set.headers['access-control-max-age'] = '600';
    })
    .derive(({ set }) => {
      const requestId = crypto.randomUUID();
      set.headers['x-request-id'] = requestId;
      return { requestId };
    })
    .options('*', ({ set }) => {
      set.status = 204;
      return new Response(null, { status: 204 });
    })
    .get('/health', ({ requestId }) => ({
      data: { status: 'ok' },
      requestId,
    }))
    .onError(({ code, error, requestId, set }) => {
      requestId ??= crypto.randomUUID();
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return { error: { code: 'not_found', message: 'Not found' }, requestId };
      }
      if (
        code === 'VALIDATION' ||
        code === 'PARSE' ||
        (error && typeof error === 'object' && 'status' in error && error.status === 422)
      ) {
        set.status = 400;
        return {
          error: { code: 'validation_error', message: 'Request validation failed' },
          requestId,
        };
      }
      set.status = 500;
      return { error: { code: 'internal_error', message: 'Internal server error' }, requestId };
    })
    .compile();
}
