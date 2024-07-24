import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      provider: 'webdriverio',
      enabled: true,
      headless: true,
      name: 'chrome',
      screenshotFailures: false,
    },
    coverage: {
      provider: 'istanbul',
      include: ['src/**'],
    },
  },
});
