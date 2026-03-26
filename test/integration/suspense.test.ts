import type { RenderContext } from 'barebind';
import { createComponent, html, Root, Runtime, SharedContext } from 'barebind';
import { Suspend, Suspense } from 'barebind/addons/suspense';
import { expect, test } from 'vitest';
import { TestBackend } from '../test-backend.js';
import { stripComments, waitForTimeout } from '../test-helpers.js';

interface AppProps {
  itemIds: string[];
  itemStorage: ItemStorage;
}

const App = createComponent<AppProps>(function App(
  { itemIds, itemStorage },
  $,
): unknown {
  const [error, setError] = $.useState<unknown>(null);

  $.use(itemStorage);

  $.catchError((error) => {
    setError(error);
  });

  if (error !== null) {
    return html`<p>${error}</p>`;
  }

  return Suspense({
    children: html`
      <ul>
        <${itemIds.map((itemId) => Item({ id: itemId }).withKey(itemId))}>
      </ul>
    `,
    fallback: html`<p>Loading...</p>`,
  });
});

const Item = createComponent<Item>(function Item(
  { id },
  $: RenderContext,
): unknown {
  const item = $.use(ItemStorage).loadItem(id).unwrap();

  return html`<li>${item.id}</li>`;
});

class ItemStorage extends SharedContext {
  cache: Map<string, Suspend.Awaited<Item>> = new Map();

  loadItem(id: string): Suspend.Awaited<Item> {
    let suspend = this.cache.get(id);

    if (suspend === undefined) {
      const controller = new AbortController();
      const promise = new Promise<Item>((resolve, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => {
            reject(controller.signal.reason);
          },
          { once: true },
        );
        setTimeout(() => {
          if (id === '') {
            reject(new Error('Item not found'));
          } else {
            resolve({ id });
          }
        });
      });
      suspend = Suspend.await(promise, controller);
      this.cache.set(id, suspend);
    }

    return suspend;
  }
}

interface Item {
  id: string;
}

test('awaits a single promise in a child component', async () => {
  const itemStorage = new ItemStorage();
  const source = App({
    itemIds: ['foo'],
    itemStorage,
  });
  const container = document.createElement('div');
  const root = Root.create(source, container, new Runtime(new TestBackend()));

  SESSION1: {
    await root.mount().finished;

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
  }

  SESSION2: {
    await waitForTimeout(1);

    expect(stripComments(container).innerHTML).toBe('<ul><li>foo</li></ul>');
  }

  SESSION3: {
    await root.unmount().finished;

    expect(container.innerHTML).toBe('');
  }
});

test('awaits promises in parallel across child components', async () => {
  const itemStorage = new ItemStorage();
  const source = App({
    itemIds: ['foo', 'bar'],
    itemStorage,
  });
  const container = document.createElement('div');
  const root = Root.create(source, container, new Runtime(new TestBackend()));

  SESSION1: {
    await root.mount().finished;

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
  }

  SESSION2: {
    await waitForTimeout(1);

    expect(stripComments(container).innerHTML).toBe(
      '<ul><li>foo</li><li>bar</li></ul>',
    );
  }

  SESSION3: {
    await root.update(
      App({
        itemIds: ['bar', 'baz'],
        itemStorage,
      }),
    ).finished;

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
  }

  SESSION4: {
    await waitForTimeout(1);

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
  const itemStorage = new ItemStorage();
  const source = App({
    itemIds: ['foo', ''],
    itemStorage,
  });
  const container = document.createElement('div');
  const root = Root.create(source, container, new Runtime(new TestBackend()));

  SESSION1: {
    await root.mount().finished;

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
  }

  SESSION2: {
    await waitForTimeout(1);

    expect(stripComments(container).innerHTML).toBe(
      '<p>Error: Item not found</p>',
    );
  }

  await root.unmount().finished;

  expect(stripComments(container).innerHTML).toBe('');
});

test('aborts pending items on unmount', async () => {
  const itemStorage = new ItemStorage();
  const source = App({
    itemIds: ['foo'],
    itemStorage,
  });
  const container = document.createElement('div');
  const root = Root.create(source, container, new Runtime(new TestBackend()));

  SESSION1: {
    await root.mount().finished;

    expect(stripComments(container).innerHTML).toBe('<p>Loading...</p>');
  }

  SESSION2: {
    await root.unmount().finished;

    expect(stripComments(container).innerHTML).toBe('');
  }

  expect(itemStorage.cache.get('foo')?.status).toBe('aborted');
});
