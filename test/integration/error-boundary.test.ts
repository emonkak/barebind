import {
  BrowserBackend,
  createComponent,
  type RenderContext,
  RenderError,
  Root,
  Runtime,
} from 'barebind';
import { expect, test } from 'vitest';

import { stripComments } from '../test-helpers.js';

const App = createComponent<{ children: unknown }>(function App({ children }) {
  return children;
});

const Fail = createComponent(function Fail() {
  throw new Error('fail');
});

const RecoverOnTransaction = createComponent(function Fail(_props, $) {
  const [capturedError, setCapturedError] = $.useState<unknown>(null);

  $.useLayoutEffect(() => {
    $.startTransition(() => {
      throw new Error('fail in transition');
    }).finished.catch((error) => {
      setCapturedError(error, { flushSync: true, immediate: true });
    });
  }, []);

  return capturedError !== null
    ? $.html`<p>${String(capturedError)}</p>`
    : null;
});

const ErrorBoundary = createComponent<{
  children: unknown;
  getFallback?: (error: unknown, $: RenderContext) => unknown;
}>(function ErrorBoundary({ children, getFallback }, $): unknown {
  const [errorCapture, setErrorCapture] = $.useState<{
    fallback: unknown;
    children: unknown;
  } | null>(null);

  $.catchError((error) => {
    if (getFallback !== undefined) {
      setErrorCapture({
        fallback: getFallback(error, $),
        children,
      });
    }
  });

  return errorCapture !== null && errorCapture.children === children
    ? errorCapture.fallback
    : children;
});

test('renders the fallback when an error occurs during rendering', async () => {
  const source = ErrorBoundary({
    children: App({ children: Fail({}) }),
    getFallback: (error, $) => $.html`<p>${String(error)}</p>`,
  });
  const container = document.createElement('div');
  const root = Root.create(
    source,
    container,
    new Runtime(new BrowserBackend()),
  );

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe('<p>Error: fail</p>');

  await root.unmount().finished;

  expect(container.innerHTML).toBe('');
});

test('treates errors as interrupts when there is no fallback', async () => {
  const source = App({
    children: ErrorBoundary({
      children: Fail({}),
    }),
  });
  const container = document.createElement('div');
  const root = Root.create(
    source,
    container,
    new Runtime(new BrowserBackend()),
  );

  expect(await root.mount().finished).toStrictEqual({
    status: 'canceled',
    reason: expect.objectContaining({
      message: 'fail',
    }),
  });
});

test('throws uncaught errors as RenderError', async () => {
  const source = App({ children: Fail({}) });
  const container = document.createElement('div');
  const root = Root.create(
    source,
    container,
    new Runtime(new BrowserBackend()),
  );

  try {
    await root.mount().finished;
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(RenderError);
    expect((error as RenderError).cause).toStrictEqual(
      expect.objectContaining({
        message: 'fail',
      }),
    );
  }
});

test('captures errors that occur during the transition', async () => {
  const source = App({ children: RecoverOnTransaction({}) });
  const container = document.createElement('div');
  const root = Root.create(
    source,
    container,
    new Runtime(new BrowserBackend()),
  );

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe(
    '<p>Error: fail in transition</p>',
  );
});
