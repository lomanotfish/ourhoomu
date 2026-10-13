import { createApp } from './app';
import { env } from 'cloudflare:workers';
import type { RuntimeEnv } from './config';

const runtimeEnv = env as RuntimeEnv;
const app = createApp({ appEnv: runtimeEnv.APP_ENV, allowedOrigin: runtimeEnv.ALLOWED_ORIGIN });

export default app;
