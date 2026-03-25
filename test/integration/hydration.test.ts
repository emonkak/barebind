import { BrowserBackend, createComponent, html, Root, Runtime } from 'barebind';
import { expect, test } from 'vitest';

import { createElement, stripComments } from '../test-helpers.js';

interface GreetProps {
  name: string;
}

const Greet = createComponent<GreetProps>(function Greet({ name }): unknown {
  return html`<p>Hello, ${name}!</p>`;
});

test('hydrates a template that contain split text nodes', async () => {
  const value = Greet({
    name: 'JavaScript',
  });
  const container = createElement(
    'div',
    {},
    createElement(
      'p',
      {},
      'Hello, ',
      document.createComment('#comment'),
      'JavaScript',
      document.createComment('#comment'),
      '!',
      document.createComment(''),
    ),
  );
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  SESSION1: {
    await root.hydrate().finished;

    expect(stripComments(container).innerHTML).toBe(
      '<p>Hello, JavaScript!</p>',
    );
  }

  SESSION2: {
    await root.unmount().finished;

    expect(container.innerHTML).toBe('');
  }
});
