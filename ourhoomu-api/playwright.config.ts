import { defineConfig } from '@playwright/test';
const port = Number(process.env.CORE_HTTP_PORT ?? '18765');
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid local acceptance port');
export default defineConfig({
  testDir: './http-acceptance',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [['list']],
  outputDir: 'test-results/core-http',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'off', screenshot: 'off', video: 'off' },
  webServer: {
    command: 'bun tests/fixtures/core-http-server.ts',
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
