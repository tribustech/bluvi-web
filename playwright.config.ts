import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './tests/e2e/helpers/base-url';

/*
 * Smoke tests against the dev server that is already running (`npm run dev`) and the local CMS
 * on :1337. No webServer: the tests never start or stop either. BASE_URL picks the server
 * (tests/e2e/helpers/base-url.ts); no spec overrides it.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Owner rule 3 (the phone header stack never floats) where it used to fail: iOS Safari's engine.
    { name: 'webkit-iphone', use: { ...devices['iPhone 13'] }, testMatch: /detail-airbnb\.spec\.ts$/, grep: /owner rule 3/ },
  ],
});
