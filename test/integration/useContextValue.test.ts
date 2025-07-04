import { expect, test } from 'vitest';

import { component } from '@/component.js';
import type { RenderContext } from '@/directive.js';
import { BrowserRenderHost } from '@/renderHost/browser.js';
import { createSyncRoot } from '@/root/sync.js';
import { createElement } from '../testUtils.js';

test('hydrate the component using a context value', () => {
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
  const root = createSyncRoot(value, container, new BrowserRenderHost());

  root.hydrate();

  expect(container.innerHTML).toBe(
    '<div>Hello, <strong>foo</strong>!<!--/Child({name: "foo"})--></div><!--/Parent({greet: "Hello", name: "foo"})-->',
  );

  root.unmount();

  expect(container.innerHTML).toBe('');
});

test('render the component using a context value', () => {
  const value1 = component(Parent, {
    greet: 'Hello',
    name: 'foo',
  });
  const value2 = component(Parent, {
    greet: 'Chao',
    name: 'bar',
  });
  const container = document.createElement('div');
  const root = createSyncRoot(value1, container, new BrowserRenderHost());

  root.mount();

  expect(container.innerHTML).toBe(
    '<div>Hello, <strong>foo</strong>!<!--/Child({name: "foo"})--></div><!--/Parent({greet: "Hello", name: "foo"})-->',
  );

  root.update(value2);

  expect(container.innerHTML).toBe(
    '<div>Chao, <strong>bar</strong>!<!--/Child({name: "bar"})--></div><!--/Parent({greet: "Chao", name: "bar"})-->',
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
