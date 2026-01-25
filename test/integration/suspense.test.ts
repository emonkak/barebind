import { expect, test } from 'vitest';

import { Resource, Suspense } from '@/addons/suspense.js';
import { createComponent } from '@/component.js';
import type { RenderContext } from '@/internal.js';
import { Repeat } from '@/repeat.js';
import { Root } from '@/root.js';
import { BrowserBackend } from '@/runtime/browser.js';
import { Runtime } from '@/runtime.js';
import { stripComments, waitUntilIdle } from '../test-helpers.js';

const RESOURCE_TABLE: Record<string, string> = {
  foo: 'foo',
  bar: 'bar',
  baz: 'baz',
};

test('suspends on a single promise in a child component', async () => {
  const resourceFetcher = new ResourceFetcher(RESOURCE_TABLE);
  const value = App({ resourceFetcher, resourceIds: ['foo'] });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');

  expect(await resourceFetcher.waitForAll()).toBe(1);
  await waitUntilIdle();

  expect(stripComments(container).innerHTML).toBe('<ul><li>foo</li></ul>');

  await root.unmount().finished;

  expect(container.innerHTML).toBe('');
});

test('loads promises in parallel across child components', async () => {
  const resourceFetcher = new ResourceFetcher(RESOURCE_TABLE);
  const value = App({
    resourceFetcher,
    resourceIds: ['foo', 'baz'],
  });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');

  expect(await resourceFetcher.waitForAll()).toBe(2);
  await waitUntilIdle();

  expect(stripComments(container).innerHTML).toBe(
    '<ul><li>foo</li><li>baz</li></ul>',
  );

  await root.update(
    App({
      resourceFetcher,
      resourceIds: ['bar', 'baz'],
    }),
  ).finished;

  expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');

  expect(await resourceFetcher.waitForAll()).toBe(1);
  await waitUntilIdle();

  expect(stripComments(container).innerHTML).toBe(
    '<ul><li>bar</li><li>baz</li></ul>',
  );

  await root.unmount().finished;

  expect(container.innerHTML).toBe('');
});

test('throws the rejection reason when a suspended promise rejects', async () => {
  const resourceFetcher = new ResourceFetcher(RESOURCE_TABLE);
  const value = App({ resourceFetcher, resourceIds: ['foo', 'bar', 'qux'] });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');

  expect(await resourceFetcher.waitForAll()).toBe(3);
  await waitUntilIdle(); // wait for retry rendering

  expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');

  await waitUntilIdle(); // wait for error recovery

  expect(stripComments(container).innerHTML).toBe(
    '<p>Error: Resource qux not found</p>',
  );

  await root.unmount().finished;

  expect(stripComments(container).innerHTML).toBe('');
});

test('aborts pending resources on unmount', async () => {
  const resourceFetcher = new ResourceFetcher(RESOURCE_TABLE);
  const value = App({ resourceFetcher, resourceIds: ['foo'] });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');

  expect(await resourceFetcher.waitForAll()).toBe(1);

  await root.unmount().finished;

  expect(stripComments(container).innerHTML).toBe('');
});

const App = createComponent(function App(
  {
    resourceFetcher,
    resourceIds,
  }: {
    resourceIds: string[];
    resourceFetcher: ResourceFetcher;
  },
  $: RenderContext,
): unknown {
  const [error, setError] = $.useState<unknown>(null);

  $.setSharedContext(ResourceFetcher, resourceFetcher);

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
          items: resourceIds,
          keySelector: (resourceId) => resourceId,
          valueSelector: (resourceId, index) =>
            ResourceLoader({ delay: index + 1, resourceId }),
        })}>
      </ul>
    `,
    fallback: Fallback({}),
  });
});

const ResourceLoader = createComponent(function Loader(
  { delay, resourceId }: { delay: number; resourceId: string },
  $: RenderContext,
): unknown {
  const resourceFetcher = $.getSharedContext(
    ResourceFetcher,
  ) as ResourceFetcher;
  const resource = $.use(
    Resource(
      (signal) => resourceFetcher.fetch(resourceId, delay, signal),
      [resourceId],
    ),
  );

  return $.html`<li>${resource.unwrap()}</li>`;
});

const Fallback = createComponent(function Fallback(
  {}: {},
  $: RenderContext,
): unknown {
  return $.html`<p>Loading...</p>`;
});

class ResourceFetcher<T = unknown> {
  private readonly _resourceTable: Record<string, T>;

  private _pendingPromises: Promise<T>[] = [];

  constructor(resource: Record<string, T>) {
    this._resourceTable = resource;
  }

  fetch(resourceId: string, delay: number, signal: AbortSignal): Promise<T> {
    const promise = this._fetch(resourceId, delay, signal);
    this._pendingPromises.push(promise);
    return promise;
  }

  async waitForAll(): Promise<number> {
    let waitCount = 0;
    while (this._pendingPromises.length > 0) {
      const pendingPromises = this._pendingPromises;
      this._pendingPromises = [];
      await Promise.allSettled(pendingPromises);
      waitCount += pendingPromises.length;
    }
    return waitCount;
  }

  private async _fetch(
    resourceId: string,
    delay: number,
    signal: AbortSignal,
  ): Promise<T> {
    await sleep(delay);
    signal.throwIfAborted();
    const resource = this._resourceTable[resourceId];
    if (resource === undefined) {
      throw new Error(`Resource ${resourceId} not found`);
    }
    return resource;
  }
}

function sleep(delay: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}
