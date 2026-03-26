import { createComponent, html } from 'barebind';
import { expect, test, vi } from 'vitest';
import { createTestRoot } from '../adapter.js';
import { stripComments } from '../helpers.js';

const App = createComponent<{
  effect: () => void;
}>(function App({ effect }, $) {
  $.catchError(() => {});

  $.useLayoutEffect(effect);

  return html`
    <main>
      <${Parent({})}>
    </main>
  `;
});

const Parent = createComponent(function Parent() {
  return html`<p><${Child({})}></p>`;
});

const Child = createComponent(function Child() {
  throw new Error('Fail');
});

test('does not commit any effects when an error occurs during render', async () => {
  const effect = vi.fn();
  const container = document.createElement('div');
  const root = createTestRoot(App({ effect }), container);

  await root.mount().finished;

  expect(effect).not.toHaveBeenCalled();
  expect(stripComments(container).innerHTML).toBe('');

  await root.unmount().finished;

  expect(effect).not.toHaveBeenCalled();
  expect(container.innerHTML).toBe('');
});
