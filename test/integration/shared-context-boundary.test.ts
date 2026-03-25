import {
  BrowserBackend,
  createComponent,
  html,
  type RenderContext,
  Root,
  Runtime,
} from 'barebind';
import { expect, test } from 'vitest';

import { stripComments } from '../test-helpers.js';

test('mount a component using a context value', async () => {
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

  SESSION1: {
    await root.mount().finished;

    expect(stripComments(container).innerHTML).toBe(
      '<div>Hello, <strong>foo</strong>!</div>',
    );
  }

  SESSION2: {
    await root.update(value2).finished;

    expect(stripComments(container).innerHTML).toBe(
      '<div>Chao, <strong>bar</strong>!</div>',
    );
  }

  SESSION3: {
    await root.unmount().finished;

    expect(container.innerHTML).toBe('');
  }
});

interface ParentProps {
  greet: string;
  name: string;
}

const Parent = createComponent(function Parent(
  { name, greet }: ParentProps,
  $: RenderContext,
): unknown {
  $.setSharedContext('greet', greet);

  return Child({ name });
});

interface ChildProps {
  name: string;
}

const Child = createComponent(function Child(
  { name }: ChildProps,
  $: RenderContext,
): unknown {
  const greet = $.getSharedContext('greet');

  return html`<div>${greet}, <strong>${name}</strong>!</div>`;
});
