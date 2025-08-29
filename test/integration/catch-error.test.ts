import { expect, test } from 'vitest';
import { BrowserBackend } from '@/backend/browser.js';
import { createComponent } from '@/component.js';
import type { RenderContext } from '@/internal.js';
import { Root } from '@/root.js';
import { stripComments } from '../test-helpers.js';

test('render a component using a context value', async () => {
  const value = Parent({});
  const container = document.createElement('div');
  const root = Root.create(value, container, new BrowserBackend());

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe(
    '<div>Opps, an error occurred!</div>',
  );

  await root.unmount().finished;

  expect(container.innerHTML).toBe('');
});

const Parent = createComponent(function Parent(
  _props: {},
  context: RenderContext,
): unknown {
  const [error, setError] = context.useState<unknown>(null);

  context.catchError((error) => {
    setError(error, { immediate: true });
  });

  if (error) {
    return context.html`<div>Opps, an error occurred!</div>`;
  } else {
    return context.html`<div>${Child({})}</div>`;
  }
});

const Child = createComponent(function Child(
  _props: {},
  _context: RenderContext,
): unknown {
  throw new Error();
});
