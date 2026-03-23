import { BrowserBackend, createComponent, html, Root, Runtime } from 'barebind';
import { expect, test, vi } from 'vitest';

import { stripComments } from '../test-helpers.js';

test('does not commit any effects when an error occurs during render', async () => {
  const effect = vi.fn();

  const value = App({ effect });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  SESSION1: {
    await root.mount().finished;

    expect(effect).not.toHaveBeenCalled();
    expect(stripComments(container).innerHTML).toBe('');
  }

  SESSION2: {
    await root.unmount().finished;

    expect(effect).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe('');
  }
});

const App = createComponent<{
  effect: () => void;
}>(function App({ effect }) {
  return html`
    <main>
      <${AbortOnError({ effect, children: Parent({}) })}>
    </main>
  `;
});

const Parent = createComponent(function Parent() {
  return html`<p><${Child({})}></p>`;
});

const Child = createComponent(function Child() {
  throw new Error('Fail');
});

const AbortOnError = createComponent<{ effect: () => void; children: unknown }>(
  function ErrorBoundary({ effect, children }, $) {
    $.catchError(() => {});

    $.useLayoutEffect(effect);

    return children;
  },
);
