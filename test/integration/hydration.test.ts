import { createComponent, createHydrationRoot, html } from 'barebind';
import { expect, test } from 'vitest';

import { createElement, stripComments } from '../helpers.js';

interface AppProps {
  name: string;
}

const App = createComponent<AppProps>(function App({ name }) {
  return html`<p>Hello, ${name}!</p>`;
});

test('hydrates a template containing split text nodes', async () => {
  const container = createElement(
    'div',
    {},
    createElement(
      'p',
      {},
      'Hello, ',
      document.createComment(''),
      'JavaScript',
      document.createComment(''),
      '!',
      document.createComment(''),
    ),
  );
  const root = createHydrationRoot(
    App({
      name: 'JavaScript',
    }),
    container,
  );

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe('<p>Hello, JavaScript!</p>');

  await root.unmount().finished;

  expect(container.innerHTML).toBe('');
});
