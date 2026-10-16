import { defineConfig } from '@playwright/test';

const frontend = 'http://localhost:18057';

export default defineConfig({
  testDir: './test-harness',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/api-harness-results.json' }]],
  use: {
    baseURL: frontend,
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'EXPO_PUBLIC_APP_MODE=api EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:18058 EXPO_PUBLIC_API_LOCAL_ACCEPTANCE=true bun run web --port 18057 --host localhost',
    url: frontend,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CI: '1', EXPO_NO_TELEMETRY: '1' },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
