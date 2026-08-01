import { type SpawnOptionsWithoutStdio, spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BIOME_PATH = path.resolve(__dirname, '../../node_modules/.bin/biome');
const CONFIG_PATH = path.join(__dirname, 'biome.test.json');

let tmpDir: string;

interface SpawnAsyncReturns {
  stdout: string;
  stderr: string;
  status: number | null;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(os.tmpdir() + path.sep);
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('use-create-component-naming.grit', () => {
  describe('without generics', () => {
    it('passs when function name matches variable name', async () => {
      const code = [
        'const MyComponent = createComponent(function MyComponent() {',
        '  return html`<div></div>`;',
        '});',
      ].join('');
      const result = await lint(code);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    });

    it('reports a diagnostic when function name mismatches variable name', async () => {
      const code = [
        'const MyComponent = createComponent(function OtherComponent() {',
        '  return html`<div></div>`;',
        '});',
      ].join('');
      const result = await lint(code);
      expect(result.stderr).toContain(
        'Component function name must match the assigned const variable name.',
      );
      expect(result.status).toBe(0);
    });

    it('reports a diagnostic when using an anonymous function', async () => {
      const code = [
        'createComponent(function() { ',
        '  return html`<div></div>`;',
        '});',
      ].join('');
      const result = await lint(code);
      expect(result.stderr).toContain(
        'createComponent() must take a named function expression, anonymous functions are not allowed.',
      );
      expect(result.status).toBe(0);
    });

    it('reports a diagnostic when using an arrow function', async () => {
      const code = ['createComponent(() => html`<div></div>`);'].join('');
      const result = await lint(code);
      expect(result.stderr).toContain(
        'createComponent() must take a named function expression, arrow functions are not allowed.',
      );
      expect(result.status).toBe(0);
    });
  });

  describe('with generics', () => {
    it('passs when function name matches variable name', async () => {
      const code = [
        'const MyComponent = createComponent<MyComponentProps>(function MyComponent() {',
        '  return html`<div></div>`;',
        '});',
      ].join('');
      const result = await lint(code);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    });

    it('reports a diagnostic when function name mismatches variable name', async () => {
      const code = [
        'const MyComponent = createComponent<MyComponentProps>(function OtherComponent() {',
        '  return html`<div></div>`;',
        '});',
      ].join('');
      const result = await lint(code);
      expect(result.stderr).toContain(
        'Component function name must match the assigned const variable name.',
      );
      expect(result.status).toBe(0);
    });

    it('reports a diagnostic when using an anonymous function', async () => {
      const code = [
        'createComponent<MyComponentProps>(function() { ',
        '  return html`<div></div>`;',
        '});',
      ].join('');
      const result = await lint(code);
      expect(result.stderr).toContain(
        'createComponent() must take a named function expression, anonymous functions are not allowed.',
      );
      expect(result.status).toBe(0);
    });

    it('reports a diagnostic when using an arrow function', async () => {
      const code = [
        'createComponent<MyComponentProps>(() => html`<div></div>`);',
      ].join('');
      const result = await lint(code);
      expect(result.stderr).toContain(
        'createComponent() must take a named function expression, arrow functions are not allowed.',
      );
      expect(result.status).toBe(0);
    });
  });
});

async function lint(code: string): Promise<SpawnAsyncReturns> {
  const inputFile = path.join(tmpDir, 'input.ts');

  // Biome ever reports lint diagnostics for stdin input (by design, see
  // biomejs/biome#6420), Linting physical files on disk is the only reliable
  // way to surface plugin diagnostics.
  await fs.writeFile(inputFile, code);

  return await spawnAsync(
    BIOME_PATH,
    ['lint', '--config-path', CONFIG_PATH, inputFile],
    {
      cwd: tmpDir,
    },
  );
}

function spawnAsync(
  command: string,
  args?: readonly string[],
  options?: SpawnOptionsWithoutStdio,
): Promise<SpawnAsyncReturns> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (status) => {
      resolve({ stdout, stderr, status });
    });
  });
}
