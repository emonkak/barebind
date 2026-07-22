import fs from 'node:fs/promises';
import path from 'node:path';
import esbuild from 'esbuild';
import { expect, test } from 'vitest';

import { minifyTemplates } from '@/index.js';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

test.for([
  'function-call.js',
  'method-call.js',
  'nested-templates.js',
])('minify template literals in %s', async (filename) => {
  const inputPath = path.join(FIXTURES_DIR, filename);
  const expectedPath = path.join(
    FIXTURES_DIR,
    path.basename(filename, '.js') + '.expected.js',
  );

  const output = await bundle(inputPath);
  const expected = await fs.readFile(expectedPath, 'utf8');

  expect(output).toBe(expected);
});

async function bundle(entryPoint: string): Promise<string> {
  const result = await esbuild.build({
    bundle: true,
    entryPoints: [entryPoint],
    format: 'esm',
    write: false,
    plugins: [minifyTemplates()],
  });
  return result.outputFiles[0]!.text;
}
