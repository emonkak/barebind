import {
  BrowserBackend,
  createComponent,
  type RenderContext,
  Root,
  Runtime,
} from 'barebind';
import { expect, test, vi } from 'vitest';

import { stripComments } from '../test-helpers.js';

test('does not commit any DOM when an error occurs during render', async () => {
  const effect = vi.fn();

  const value = App({ effect });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  SESSION1: {
    await root.mount().finished;

    expect(effect).not.toHaveBeenCalled();
    expect(stripComments(container).innerHTML).toBe('<main></main>');
  }

  SESSION2: {
    await root.unmount().finished;

    expect(effect).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe('');
  }
});

const App = createComponent(function App(
  { effect }: { effect: () => void },
  $: RenderContext,
): unknown {
  return $.html`
    <main>
      <${AbortOnError({ effect, children: Parent({}) })}>
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
  { effect, children }: { effect: () => void; children: unknown },
  $: RenderContext,
): unknown {
  $.catchError(() => {});

  $.useLayoutEffect(effect);

  return children;
});
