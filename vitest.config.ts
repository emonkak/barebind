import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'vitest.project.ts',
      'examples/*/vitest.project.ts',
      'tools/*/vitest.project.ts',
    ],
    coverage: {
      include: ['src/**'],
      exclude: [
        'src/extras/jsx-dev-runtime.ts',
        'src/extras/router.ts',
        'src/index.ts',
      ],
    },
  },
});
