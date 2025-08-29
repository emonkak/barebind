import { expect, test } from 'vitest';
import { BrowserBackend } from '@/backend/browser.js';
import { createComponent } from '@/component.js';
import type { RenderContext } from '@/internal.js';
import { Root } from '@/root.js';
import { Runtime } from '@/runtime.js';
import { stripComments } from '../test-helpers.js';

test('catches an error during rendering', async () => {
  const value = App({});
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe(
    '<main><h1>Opps, an error occurred!</h1><p>Error: User error</p></main>',
  );

  await root.unmount().finished;

  expect(container.innerHTML).toBe('');
});

const App = createComponent(function App(
  _props: {},
  context: RenderContext,
): unknown {
  return context.html`
    <main>
      <${ErrorBoundary({ children: Parent({}) })}>
    </main>
  `;
});

const Parent = createComponent(function Parent(): unknown {
  return Child({});
});

const Child = createComponent(function Child(): unknown {
  throw new Error('User error');
});

const ErrorBoundary = createComponent(function ErrorBoundary(
  { children }: { children: unknown },
  context: RenderContext,
): unknown {
  const [errorCapture, setErrorCapture] = context.useState<{
    error: unknown;
    children: unknown;
  } | null>(null);

  context.catchError((error) => {
    setErrorCapture({
      error,
      children,
    });
  });

  context.catchError((error, handle) => {
    handle(error);
  });

  if (errorCapture !== null && errorCapture.children === children) {
    return context.html`
      <h1>Opps, an error occurred!</h1>
      <p>${String(errorCapture.error)}</p>
    `;
  } else {
    return children;
  }
});
