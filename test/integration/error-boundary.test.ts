import { expect, test } from 'vitest';

import { createComponent } from '@/component.js';
import type { RenderContext } from '@/internal.js';
import { Root } from '@/root.js';
import { BrowserBackend } from '@/runtime/browser.js';
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

const App = createComponent(function App({}: {}, $: RenderContext): unknown {
  return $.html`
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
  $: RenderContext,
): unknown {
  const [errorCapture, setErrorCapture] = $.useState<{
    error: unknown;
    children: unknown;
  } | null>(null);

  $.catchError((error) => {
    setErrorCapture({
      error,
      children,
    });
  });

  $.catchError((error, handleError) => {
    handleError(error);
  });

  if (errorCapture !== null && errorCapture.children === children) {
    return $.html`
      <h1>Opps, an error occurred!</h1>
      <p>${String(errorCapture.error)}</p>
    `;
  } else {
    return children;
  }
});
