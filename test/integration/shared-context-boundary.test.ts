import { expect, test } from 'vitest';
import { createComponent } from '@/component.js';
import type { RenderContext } from '@/internal.js';
import { Root } from '@/root.js';
import { BrowserBackend } from '@/runtime/browser.js';
import { Runtime } from '@/runtime.js';
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
  );
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  await root.hydrate().finished;

  expect(stripComments(container).innerHTML).toBe(
    '<div>Hello, <strong>foo</strong>!</div>',
  );

  await root.unmount().finished;

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
  const root = Root.create(
    value1,
    container,
    new Runtime(new BrowserBackend()),
  );

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe(
    '<div>Hello, <strong>foo</strong>!</div>',
  );

  await root.update(value2).finished;

  expect(stripComments(container).innerHTML).toBe(
    '<div>Chao, <strong>bar</strong>!</div>',
  );

  await root.unmount().finished;

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
  context.setSharedContext('greet', greet);

  return Child({ name });
});

interface ChildProps {
  name: string;
}

const Child = createComponent(function Child(
  { name }: ChildProps,
  context: RenderContext,
): unknown {
  const greet = context.getSharedContext('greet');

  return context.html`<div>${greet}, <strong>${name}</strong>!</div>`;
});
