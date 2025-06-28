import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2020',
  },
  test: {
    setupFiles: ['test/setup.ts'],
    browser: {
      provider: 'playwright',
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      screenshotFailures: false,
    },
    coverage: {
      include: ['src/**'],
      exclude: ['src/index.ts', 'src/router.ts'],
    },
  },
});
