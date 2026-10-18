import { createRuntimeApp } from './modules/core/runtime';
import { env } from 'cloudflare:workers';
import type { RuntimeEnv } from './config';

const runtimeEnv = env as RuntimeEnv;
const app = createRuntimeApp(
  { appEnv: runtimeEnv.APP_ENV, allowedOrigin: runtimeEnv.ALLOWED_ORIGIN },
  runtimeEnv,
);

export default { fetch: async (request: Request) => (await app).fetch(request) };
