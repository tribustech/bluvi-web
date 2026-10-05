import { defineConfig, devices } from '@playwright/test';

/*
 * Visual baselines (ROADMAP §5): `npm run test:visual` compares, `npm run test:visual:update`
 * rewrites the PNGs under tests/visual/__screenshots__/. Baselines are committed only after the
 * owner approves them (see README.md). Like the e2e config, it runs against the dev server that
 * is already up (VISUAL_BASE_URL overrides, e.g. a `next start` build) and the local CMS.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.visual.spec.ts',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: '../../playwright-report/visual', open: 'never' }]],
  outputDir: '../../test-results/visual',
  // One PNG per spec · state · width · platform: font rasterising differs between macOS and the
  // Linux CI image, so each platform keeps its own baseline.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}-{platform}{ext}',
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // Anti-aliasing noise only; a real layout or colour change is far above this.
      maxDiffPixelRatio: 0.002,
      threshold: 0.2,
    },
  },
  use: {
    baseURL: process.env.VISUAL_BASE_URL ?? 'http://localhost:3000',
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],
});
