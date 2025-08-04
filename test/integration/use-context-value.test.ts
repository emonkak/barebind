import { expect, test } from 'vitest';
import { BrowserBackend } from '@/backend/browser.js';
import { component } from '@/component.js';
import type { RenderContext } from '@/core.js';
import { SyncRoot } from '@/root/sync.js';
import { createElement, stripComments } from '../test-utils.js';

test('hydrate a component using a context value', () => {
  const value = component(Parent, {
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
  const root = SyncRoot.create(value, container, new BrowserBackend());

  root.hydrate();

  expect(stripComments(container).innerHTML).toBe(
    '<div>Hello, <strong>foo</strong>!</div>',
  );

  root.unmount();

  expect(container.innerHTML).toBe('');
});

test('render a component using a context value', () => {
  const value1 = component(Parent, {
    greet: 'Hello',
    name: 'foo',
  });
  const value2 = component(Parent, {
    greet: 'Chao',
    name: 'bar',
  });
  const container = document.createElement('div');
  const root = SyncRoot.create(value1, container, new BrowserBackend());

  root.mount();

  expect(stripComments(container).innerHTML).toBe(
    '<div>Hello, <strong>foo</strong>!</div>',
  );

  root.update(value2);

  expect(stripComments(container).innerHTML).toBe(
    '<div>Chao, <strong>bar</strong>!</div>',
  );

  root.unmount();

  expect(container.innerHTML).toBe('');
});

interface ParentProps {
  greet: string;
  name: string;
}

function Parent({ name, greet }: ParentProps, context: RenderContext): unknown {
  context.setContextValue('greet', greet);

  return context.html`<div><${component(Child, { name })}></div>`;
}

interface ChildProps {
  name: string;
}

function Child({ name }: ChildProps, context: RenderContext): unknown {
  const greet = context.getContextValue('greet');

  return context.html`${greet}, <strong>${name}</strong>!`;
}
