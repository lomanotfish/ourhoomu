import { defineConfig } from '@playwright/test';

// ACTUAL-LOCAL-HTTP BROWSER LANE (clearly labelled, separate from the offline
// fixture lane in playwright.api.config.ts). No page.route mocking: the
// browser talks to the real local API handlers on 127.0.0.1:18775, including
// the test-only synthetic issuer for sign-in. The UI dev server must listen
// on exactly http://localhost:18067 because the backend CORS allow-list
// expects that exact origin.
//
// Requires the local API to be running on 18775 before the lane starts.
const frontend = 'http://localhost:18067';
const api = 'http://127.0.0.1:18775';

export default defineConfig({
  testDir: './test-harness',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-local' }],
    ['json', { outputFile: 'test-results/api-local-http-results.json' }],
  ],
  use: {
    baseURL: frontend,
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command:
      `EXPO_PUBLIC_APP_MODE=api EXPO_PUBLIC_API_TEST_HARNESS=true ` +
      `EXPO_PUBLIC_API_HARNESS_SEED=none EXPO_PUBLIC_API_BASE_URL=${api} ` +
      `EXPO_PUBLIC_API_LOCAL_ACCEPTANCE=true bun run web --port 18067 --host localhost`,
    url: frontend,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CI: '1', EXPO_NO_TELEMETRY: '1' },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
  projects: [{ name: 'api-local-http-authenticated', testMatch: /api-local-http\.spec\.ts/ }],
});
