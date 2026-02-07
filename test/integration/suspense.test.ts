import type { RenderContext } from 'barebind';
import {
  BrowserBackend,
  createComponent,
  Repeat,
  Root,
  Runtime,
} from 'barebind';
import { Resource, Suspense } from 'barebind/addons/suspense';
import { expect, test } from 'vitest';

import {
  inspectPromise,
  stripComments,
  waitForMicrotasks,
  waitForSignal,
  waitUntil,
} from '../test-helpers.js';

test('suspends on a single promise in a child component', async () => {
  const foo = Promise.withResolvers();

  const value = App({ resources: [foo] });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  SESSION1: {
    await root.mount().finished;

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
  }

  foo.resolve('foo');

  SESSION2: {
    await waitForMicrotasks(2);
    await waitUntil('background');

    expect(stripComments(container).innerHTML).toBe('<ul><li>foo</li></ul>');
  }

  SESSION3: {
    await root.unmount().finished;

    expect(container.innerHTML).toBe('');
  }
});

test('loads resources in parallel across child components', async () => {
  const foo = Promise.withResolvers();
  const bar = Promise.withResolvers();
  const baz = Promise.withResolvers();

  const value = App({
    resources: [foo, bar],
  });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  SESSION1: {
    await root.mount().finished;

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
  }

  foo.resolve('foo');
  bar.resolve('bar');

  SESSION2: {
    await waitForMicrotasks(2);
    await waitUntil('background');

    expect(stripComments(container).innerHTML).toBe(
      '<ul><li>foo</li><li>bar</li></ul>',
    );
  }

  SESSION3: {
    await root.update(
      App({
        resources: [bar, baz],
      }),
    ).finished;

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
  }

  baz.resolve('baz');

  SESSION4: {
    await waitForMicrotasks(2);
    await waitUntil('background');

    expect(stripComments(container).innerHTML).toBe(
      '<ul><li>bar</li><li>baz</li></ul>',
    );
  }

  SESSION5: {
    await root.unmount().finished;

    expect(container.innerHTML).toBe('');
  }
});

test('throws the rejection reason when a suspended promise rejects', async () => {
  const foo = Promise.withResolvers();
  const bar = Promise.withResolvers();

  const value = App({ resources: [foo, bar] });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  SESSION1: {
    await root.mount().finished;

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
  }

  foo.resolve('foo');
  bar.reject('fail');

  SESSION2: {
    await waitForMicrotasks(2);
    await waitUntil('background');

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
  }

  SESSION3: {
    await waitUntil('background');

    expect(stripComments(container).innerHTML).toBe('<p>fail</p>');
  }

  await root.unmount().finished;

  expect(stripComments(container).innerHTML).toBe('');
});

test('aborts pending resources on unmount', async () => {
  const foo = Promise.withResolvers();

  const value = App({ resources: [foo] });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  SESSION1: {
    await root.mount().finished;

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
    expect(await inspectPromise(foo.promise)).toStrictEqual({
      status: 'pending',
    });
  }

  SESSION2: {
    await root.unmount().finished;

    expect(stripComments(container).innerHTML).toBe('');
    expect(await inspectPromise(foo.promise)).toStrictEqual({
      status: 'rejected',
      reason: 'abort',
    });
  }
});

const App = createComponent(function App(
  {
    resources,
  }: {
    resources: PromiseWithResolvers<unknown>[];
  },
  $: RenderContext,
): unknown {
  const [error, setError] = $.useState<unknown>(null);

  $.catchError((error) => {
    setError(error);
  });

  if (error !== null) {
    return $.html`<p>${error}</p>`;
  }

  return Suspense({
    children: $.html`
      <ul>
        <${Repeat({
          elementSelector: (resource) => Loader({ resource }),
          keySelector: (resourceId) => resourceId,
          source: resources,
        })}>
      </ul>
    `,
    fallback: Fallback({}),
  });
});

const Loader = createComponent(function Loader(
  { resource }: { resource: PromiseWithResolvers<unknown> },
  $: RenderContext,
): unknown {
  const suspend = $.use(
    Resource(
      (signal) => {
        signal.addEventListener('abort', () => {
          resource.reject('abort');
        });
        return Promise.race([resource.promise, waitForSignal(signal)]);
      },
      [resource],
    ),
  );

  return $.html`<li>${suspend.unwrap()}</li>`;
});

const Fallback = createComponent(function Fallback(
  {}: {},
  $: RenderContext,
): unknown {
  return $.html`<p>Loading...</p>`;
});
