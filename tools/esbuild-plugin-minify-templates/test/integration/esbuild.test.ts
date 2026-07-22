import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import esbuild from 'esbuild';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { minifyTemplates } from '@/index.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(os.tmpdir() + path.sep);
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('minifies template literals in html tag', async () => {
  const output = await bundle(
    [
      'export const Greet = createComponent(function Greet(props) {',
      '  return html`',
      '    <div',
      '      class="greet"',
      '    >',
      '      ${props.greet}, <span>${props.name}</span>!',
      '    </div>',
      '  `;',
      '});',
    ].join('\n'),
  );
  const expected = [
    'var Greet = createComponent(function Greet2(props) {',
    '  return html`<div class="greet">${props.greet}, <span>${props.name}</span>!</div>`;',
    '});',
    'export {',
    '  Greet',
    '};',
  ].join('\n');
  expect(output).toBe(expected);
});

test('minifies template literals in Partial.html tag', async () => {
  const output = await bundle(
    [
      'export const Greet = createComponent(function Greet(props) {',
      '  return Partial.html`',
      '    <div',
      '      class="greet"',
      '    >',
      '      ${props.greet}, <span>${props.name}</span>!',
      '    </div>',
      '  `;',
      '});',
    ].join('\n'),
  );
  const expected = [
    'var Greet = createComponent(function Greet2(props) {',
    '  return Partial.html`<div class="greet">${props.greet}, <span>${props.name}</span>!</div>`;',
    '});',
    'export {',
    '  Greet',
    '};',
  ].join('\n');
  expect(output).toBe(expected);
});

test('minifies nested html template literals', async () => {
  const output = await bundle(
    [
      'export function Greet(props) {',
      '  return html`',
      '    <div>',
      '      ${html`',
      '        <p>',
      '          ${props.greet}, <span>${props.name}</span>!',
      '        </p>',
      '      `}',
      '    </div>',
      '  `;',
      '}',
    ].join('\n'),
  );
  const expected = [
    'function Greet(props) {',
    '  return html`<div>${html`<p>${props.greet}, <span>${props.name}</span>!</p>`}</div>`;',
    '}',
    'export {',
    '  Greet',
    '};',
  ].join('\n');
  expect(output).toBe(expected);
});

async function bundle(code: string): Promise<string> {
  const inputPath = path.join(tmpDir, 'input.js');

  await fs.writeFile(inputPath, code);

  const result = await esbuild.build({
    bundle: true,
    entryPoints: [inputPath],
    format: 'esm',
    write: false,
    plugins: [minifyTemplates()],
  });

  return stripCommentHeader(result.outputFiles[0]!.text).trimEnd();
}

function stripCommentHeader(code: string): string {
  return code.replace(/^\/\/.*\n/, '');
}
