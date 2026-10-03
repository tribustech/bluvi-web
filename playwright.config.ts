import { defineConfig, devices } from '@playwright/test';

/*
 * Smoke tests against the dev server that is already running (`npm run dev`) and the local CMS
 * on :1337. No webServer: the tests never start or stop either.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
