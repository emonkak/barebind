import { expect, test } from 'vitest';

import { createComponent } from '@/component.js';
import type { RenderContext } from '@/internal.js';
import { Root } from '@/root.js';
import { BrowserBackend } from '@/runtime/browser.js';
import { Runtime } from '@/runtime.js';
import { stripComments } from '../test-helpers.js';

test('does not commit any DOM when an error occurs during render', async () => {
  const value = App({});
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe('<main></main>');

  await root.unmount().finished;

  expect(container.innerHTML).toBe('');
});

const App = createComponent(function App(
  _props: {},
  $: RenderContext,
): unknown {
  return $.html`
    <main>
      <${AbortOnError({ children: Parent({}) })}>
    </main>
  `;
});

const Parent = createComponent(function Parent(
  _props: {},
  $: RenderContext,
): unknown {
  return $.html`<p><${Child({})}></p>`;
});

const Child = createComponent(function Child(): unknown {
  throw new Error('Fail');
});

const AbortOnError = createComponent(function ErrorBoundary(
  { children }: { children: unknown },
  $: RenderContext,
): unknown {
  $.catchError(() => {});

  return children;
});
