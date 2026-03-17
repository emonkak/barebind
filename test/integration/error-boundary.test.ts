import {
  BrowserBackend,
  createComponent,
  InterruptError,
  type RenderContext,
  Root,
  Runtime,
} from 'barebind';
import { expect, test } from 'vitest';

import { stripComments } from '../test-helpers.js';

const App = createComponent<{ children: unknown }>(function App({ children }) {
  return children;
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
      setErrorCapture(
        {
          fallback: getFallback(error, $),
          children,
        },
        {
          flushSync: true,
          immediate: true,
        },
      );
    }
  });

  return errorCapture !== null && errorCapture.children === children
    ? errorCapture.fallback
    : children;
});

const FailOnEffect = createComponent(function FailOnEffect(_props, $) {
  $.useLayoutEffect(() => {
    $.interrupt(new Error('fail on effect'));
  }, []);
});

const FailOnRender = createComponent(function FailOnRender() {
  throw new Error('fail');
});

test('renders the fallback when an error occurs during rendering', async () => {
  const source = App({
    children: ErrorBoundary({
      children: FailOnRender({}),
      getFallback: (error, $) => $.html`<p>${String(error)}</p>`,
    }),
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

test('renders the fallback when an error occurs on effect', async () => {
  const source = App({
    children: ErrorBoundary({
      children: FailOnEffect({}),
      getFallback: (error, $) => $.html`<p>${String(error)}</p>`,
    }),
  });
  const container = document.createElement('div');
  const root = Root.create(
    source,
    container,
    new Runtime(new BrowserBackend()),
  );

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe(
    '<p>Error: fail on effect</p>',
  );

  await root.unmount().finished;

  expect(container.innerHTML).toBe('');
});

test('treates errors as interrupts when there is no fallback', async () => {
  const source = App({
    children: ErrorBoundary({
      children: FailOnRender({}),
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

test('throws uncaught errors during rendering as InterruptError', async () => {
  const source = App({ children: FailOnRender({}) });
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
    expect(error).toBeInstanceOf(InterruptError);
    expect((error as InterruptError).message).toContain(
      'An error occurred during rendering.',
    );
    expect((error as InterruptError).cause).toStrictEqual(
      expect.objectContaining({
        message: 'fail',
      }),
    );
  }
});

test('throws uncaught errors thrown by interrupt() as InterruptError', async () => {
  const source = App({ children: FailOnEffect({}) });
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
    expect(error).toBeInstanceOf(InterruptError);
    expect((error as InterruptError).message).toContain(
      'An error was thrown from the component.',
    );
    expect((error as InterruptError).cause).toStrictEqual(
      expect.objectContaining({
        message: 'fail on effect',
      }),
    );
  }
});
