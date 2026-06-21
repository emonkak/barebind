import path from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, '/src'),
    },
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      provider: playwright(),
      screenshotFailures: false,
    },
    coverage: {
      include: ['src/**'],
      exclude: ['src/index.ts'],
    },
    include: ['test/**/*.test.ts?(x)'],
    projects: [
      'examples/*/vitest.config.ts',
      'tools/*/vitest.config.ts',
      'vitest.config.ts',
    ],
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
