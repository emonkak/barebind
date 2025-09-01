import path from 'node:path';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '@': path.join(__dirname, '/src'),
    },
  },
  test: {
    include: ['test/**/*.test.ts?(x)'],
    setupFiles: ['test/setup.ts'],
    browser: {
      provider: 'playwright',
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      screenshotFailures: false,
    },
    typecheck: {
      enabled: true,
    },
  },
});
