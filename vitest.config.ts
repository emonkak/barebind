import * as path from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    benchmark: {
      include: [],
    },
    browser: {
      headless: true,
      instances: [{ browser: 'chromium' }],
      provider: playwright(),
      screenshotFailures: false,
    },
    coverage: {
      include: ['src/**'],
      exclude: ['src/index.ts'],
    },
    projects: [
      {
        extends: true,
        resolve: {
          alias: {
            '@': path.join(__dirname, '/src'),
          },
        },
        test: {
          name: 'unit',
          benchmark: {
            include: ['test/unit/**/*.bench.ts'],
          },
          browser: {
            enabled: true,
          },
          include: ['test/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          browser: {
            enabled: true,
          },
          include: ['test/integration/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'biome',
          include: ['test/biome/**/*.test.ts'],
        },
      },
      'tools/*/vitest.config.ts',
    ],
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
