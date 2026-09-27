import path from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = { '@': path.resolve(__dirname) };

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
