import { defineConfig } from '@playwright/test';

const frontend = 'http://localhost:18047';
const api = 'http://127.0.0.1:18048';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: frontend,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'Asia/Bangkok',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testMatch: /demo\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      testMatch: /demo\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: 'workerd-api', testMatch: /api\.spec\.ts/, use: { baseURL: api } },
  ],
  webServer: [
    {
      command: 'bun run web --port 18047 --host localhost',
      url: frontend,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { CI: '1', EXPO_NO_TELEMETRY: '1' },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
    {
      command:
        'node ../ourhoomu-api/node_modules/wrangler/bin/wrangler.js dev --config ../ourhoomu-api/wrangler.jsonc --local --ip 127.0.0.1 --port 18048 --inspector-port 18049 --var ALLOWED_ORIGIN:http://localhost:18047',
      url: `${api}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { WRANGLER_SEND_METRICS: 'false' },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
  ],
});
