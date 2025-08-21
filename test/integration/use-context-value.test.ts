import { expect, test } from 'vitest';
import { BrowserBackend } from '@/backend/browser.js';
import { createComponent } from '@/component.js';
import type { RenderContext } from '@/internal.js';
import { Root } from '@/root.js';
import { createElement, stripComments } from '../test-helpers.js';

test('hydrate a component using a context value', async () => {
  const value = Parent({
    greet: 'Hello',
    name: 'foo',
  });
  const container = createElement(
    'div',
    {},
    createElement(
      'div',
      {},
      ', ',
      createElement('strong', {}, ''),
      '!',
      document.createComment(''),
    ),
    document.createComment(''),
  );
  const root = Root.create(value, container, new BrowserBackend());

  await root.hydrate();

  expect(stripComments(container).innerHTML).toBe(
    '<div>Hello, <strong>foo</strong>!</div>',
  );

  await root.unmount();

  expect(container.innerHTML).toBe('');
});

test('render a component using a context value', async () => {
  const value1 = Parent({
    greet: 'Hello',
    name: 'foo',
  });
  const value2 = Parent({
    greet: 'Chao',
    name: 'bar',
  });
  const container = document.createElement('div');
  const root = Root.create(value1, container, new BrowserBackend());

  await root.mount();

  expect(stripComments(container).innerHTML).toBe(
    '<div>Hello, <strong>foo</strong>!</div>',
  );

  await root.update(value2);

  expect(stripComments(container).innerHTML).toBe(
    '<div>Chao, <strong>bar</strong>!</div>',
  );

  await root.unmount();

  expect(container.innerHTML).toBe('');
});

interface ParentProps {
  greet: string;
  name: string;
}

const Parent = createComponent(function Parent(
  { name, greet }: ParentProps,
  context: RenderContext,
): unknown {
  context.setContextValue('greet', greet);

  return context.html`<div><${Child({ name })}></div>`;
});

interface ChildProps {
  name: string;
}

const Child = createComponent(function Child(
  { name }: ChildProps,
  context: RenderContext,
): unknown {
  const greet = context.getContextValue('greet');

  return context.html`${greet}, <strong>${name}</strong>!`;
});
