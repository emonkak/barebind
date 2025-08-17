import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, '/src'),
    },
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
      exclude: ['src/extras/router.ts', 'src/index.ts'],
    },
    typecheck: {
      enabled: true,
    },
  },
});
