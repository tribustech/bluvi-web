import path from 'node:path';
import { defineConfig } from 'vitest/config';

// `server-only` throws outside a React Server Components bundle; tests import server modules directly.
const alias = { '@': path.resolve(__dirname), 'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts') };

export default defineConfig({
  resolve: { alias },
  test: {
    // Contract files share one CMS and one QA user: run files one after another so idempotent
    // round-trips (follow/unfollow, mark read) never race. Unit files are fast either way.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['core/**/*.test.ts', 'lib/**/*.test.ts', 'app/**/*.test.ts', 'tests/unit/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'contract',
          environment: 'node',
          include: ['tests/contract/**/*.contract.test.ts'],
          globalSetup: ['tests/contract/global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
