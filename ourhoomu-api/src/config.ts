import type { CoreBindings } from './modules/core/config';
export interface AppConfig {
  appEnv: string;
  allowedOrigin: string;
}

export interface RuntimeEnv extends AppConfig, CoreBindings {
  APP_ENV: string;
  ALLOWED_ORIGIN: string;
  DATABASE_URL?: string;
  RUNTIME_PROBE_ENABLED?: string;
  TEST_ACTOR_A?: string;
  TEST_ACTOR_B?: string;
}
