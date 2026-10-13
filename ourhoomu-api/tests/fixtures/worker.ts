import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import type { RuntimeEnv } from '../../src/config';

neonConfig.poolQueryViaFetch = false;

function responseId(request: Request) {
  return request.headers.get('cf-ray') ?? crypto.randomUUID();
}

export default new Elysia({ adapter: CloudflareAdapter })
  .onRequest(({ request, set }) => {
    set.headers['x-request-id'] = responseId(request);
    set.headers['access-control-allow-origin'] = 'http://localhost:8081';
    set.headers['access-control-allow-methods'] = 'GET,POST,OPTIONS';
    set.headers['access-control-allow-headers'] = 'authorization,content-type';
  })
  .options('*', ({ set }) => {
    set.status = 204;
    return new Response(null, { status: 204 });
  })
  .get('/health', ({ request }) => ({ data: { status: 'ok' }, requestId: responseId(request) }))
  .post('/runtime/validate', async ({ request, set }) => {
      const requestId = responseId(request);
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
  .post('/runtime/db/:actor', async ({ params, request, set }) => {
      const requestId = responseId(request);
      const runtimeEnv = env as RuntimeEnv;
      if (runtimeEnv.RUNTIME_PROBE_ENABLED !== 'true' || !runtimeEnv.DATABASE_URL) {
        set.status = 404;
        return { error: { code: 'not_found', message: 'Not found' }, requestId };
      }
      if (request.headers.get('authorization') !== 'Bearer runtime-fixture-only') {
        set.status = 401;
        return { error: { code: 'unauthenticated', message: 'Authentication required' }, requestId };
      }
      const actor = params.actor === 'a' ? runtimeEnv.TEST_ACTOR_A : params.actor === 'b' ? runtimeEnv.TEST_ACTOR_B : undefined;
      if (!actor) {
        set.status = 400;
        return { error: { code: 'invalid_actor', message: 'Unknown fixture actor' }, requestId };
      }

      const pool = new Pool({ connectionString: runtimeEnv.DATABASE_URL, max: 1 });
      try {
        const db = drizzle(pool);
        const result = await db.transaction(async (tx) => {
          await tx.execute(sql`select set_config('app.actor_id', ${actor}, true)`);
          const role = await tx.execute(sql`select current_user as role`);
          const actorContext = await tx.execute(sql`select current_setting('app.actor_id', true) as actor`);
          const rows = await tx.execute(sql`select actor_id, secret from runtime_probe.visible_rows order by actor_id`);
          if (new URL(request.url).searchParams.get('fail') === 'after-write') {
            await tx.execute(sql`insert into runtime_probe.rollback_probe (marker) values ('rollback-me')`);
            throw new Error('forced runtime rollback');
          }
          return { role, actorContext, rows };
        });
        const outsideActor = await pool.query('select current_setting(\'app.actor_id\', true) as actor');
        return {
          data: { role: result.role.rows[0]?.role, actor: result.actorContext.rows[0]?.actor, rows: result.rows.rows, outsideActor: outsideActor.rows[0]?.actor ?? null },
          requestId,
        };
      } catch (error) {
        set.status = 500;
        return { error: { code: 'probe_failed', message: 'Probe failed' }, requestId };
      } finally {
        await pool.end();
      }
    })
  .onError(({ code, error, request, set }) => {
    const requestId = responseId(request);
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: { code: 'not_found', message: 'Not found' }, requestId };
    }
    if (code === 'VALIDATION' || code === 'PARSE' || (error && typeof error === 'object' && 'status' in error && error.status === 422)) {
      set.status = 400;
      return { error: { code: 'validation_error', message: 'Request validation failed' }, requestId };
    }
    set.status = 500;
    return { error: { code: 'internal_error', message: 'Internal server error' }, requestId };
  })
  .compile() as unknown as { fetch(request: Request, env: RuntimeEnv): Promise<Response> };
