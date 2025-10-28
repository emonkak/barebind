import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import esbuild from 'esbuild';
import { expect, test } from 'vitest';

import { minifyTemplates } from '@/index.js';

interface TemporaryDirectoryFixture {
  outdir: string;
}

export const temporaryDirectoryTest = test.extend<TemporaryDirectoryFixture>({
  outdir: async ({}, use) => {
    const prefix = path.join(os.tmpdir(), 'vitest-');
    const outdir = await fs.mkdtemp(prefix);
    try {
      await use(outdir);
    } finally {
      await fs.rm(outdir, { recursive: true });
    }
  },
});

temporaryDirectoryTest.for([
  'function-call.js',
  'ignored-template.js',
  'method-call.js',
  'nested-templates.js',
])('minify template literals in %s', async (filename, { outdir }) => {
  const inputPath = path.join(__dirname, '../fixtures/', filename);
  const outputPath = path.join(outdir, filename);
  const expectedPath = path.join(
    __dirname,
    '../fixtures',
    path.basename(filename, '.js') + '.expected.js',
  );

  await esbuild.build({
    bundle: true,
    entryPoints: [inputPath],
    format: 'esm',
    outdir,
    plugins: [minifyTemplates()],
  });

  expect(await fs.readFile(outputPath, 'utf8')).toBe(
    await fs.readFile(expectedPath, 'utf8'),
  );
});
