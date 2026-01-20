import { expect, test } from 'vitest';

import { createComponent } from '@/component.js';
import type { HookFunction, RenderContext } from '@/internal.js';
import { Root } from '@/root.js';
import { BrowserBackend } from '@/runtime/browser.js';
import { Runtime } from '@/runtime.js';
import { Fragment } from '@/template.js';
import { stripComments } from '../test-helpers.js';

test('invokes effects from child to parent', async () => {
  const logs: string[] = [];
  const container = document.createElement('div');
  const root = Root.create<unknown>(
    Foo({ logs }),
    container,
    new Runtime(new BrowserBackend()),
  );

  await root.mount().finished;
  await scheduler.postTask(() => {}, { priority: 'background' });

  expect(stripComments(container).innerHTML).toBe(
    '<div class="Foo.parent"><div class="Foo.child1"><div class="Foo.grandchild1"></div></div><div class="Foo.child2"><div class="Foo.grandchild2"></div></div></div>',
  );
  expect(logs).toStrictEqual([
    'render Foo.parent',
    'render Foo.child1',
    'render Foo.child2',
    'render Foo.grandchild1',
    'render Foo.grandchild2',
    'invoke #0 mutation effect in Foo.grandchild1',
    'invoke #1 mutation effect in Foo.grandchild1',
    'invoke #0 mutation effect in Foo.grandchild2',
    'invoke #1 mutation effect in Foo.grandchild2',
    'invoke #0 mutation effect in Foo.child1',
    'invoke #1 mutation effect in Foo.child1',
    'invoke #0 mutation effect in Foo.child2',
    'invoke #1 mutation effect in Foo.child2',
    'invoke #0 mutation effect in Foo.parent',
    'invoke #1 mutation effect in Foo.parent',
    'invoke ref in Foo.parent',
    'invoke ref in Foo.child1',
    'invoke ref in Foo.child2',
    'invoke ref in Foo.grandchild1',
    'invoke ref in Foo.grandchild2',
    'invoke #0 layout effect in Foo.grandchild1',
    'invoke #1 layout effect in Foo.grandchild1',
    'invoke #0 layout effect in Foo.grandchild2',
    'invoke #1 layout effect in Foo.grandchild2',
    'invoke #0 layout effect in Foo.child1',
    'invoke #1 layout effect in Foo.child1',
    'invoke #0 layout effect in Foo.child2',
    'invoke #1 layout effect in Foo.child2',
    'invoke #0 layout effect in Foo.parent',
    'invoke #1 layout effect in Foo.parent',
    'invoke #0 passive effect in Foo.grandchild1',
    'invoke #1 passive effect in Foo.grandchild1',
    'invoke #0 passive effect in Foo.grandchild2',
    'invoke #1 passive effect in Foo.grandchild2',
    'invoke #0 passive effect in Foo.child1',
    'invoke #1 passive effect in Foo.child1',
    'invoke #0 passive effect in Foo.child2',
    'invoke #1 passive effect in Foo.child2',
    'invoke #0 passive effect in Foo.parent',
    'invoke #1 passive effect in Foo.parent',
  ]);

  logs.length = 0;

  await root.update(Bar({ logs })).finished;
  await scheduler.postTask(() => {}, { priority: 'background' });

  expect(stripComments(container).innerHTML).toBe(
    '<div class="Bar.parent"><div class="Bar.child1"><div class="Bar.grandchild1"></div></div></div>',
  );
  expect(logs).toStrictEqual([
    'render Bar.parent',
    'render Bar.child1',
    'render Bar.grandchild1',
    'clean #0 mutation effect in Foo.parent',
    'clean #1 mutation effect in Foo.parent',
    'clean #0 mutation effect in Foo.child1',
    'clean #1 mutation effect in Foo.child1',
    'clean #0 mutation effect in Foo.grandchild1',
    'clean #1 mutation effect in Foo.grandchild1',
    'clean #0 mutation effect in Foo.child2',
    'clean #1 mutation effect in Foo.child2',
    'clean #0 mutation effect in Foo.grandchild2',
    'clean #1 mutation effect in Foo.grandchild2',
    'invoke #0 mutation effect in Bar.grandchild1',
    'invoke #1 mutation effect in Bar.grandchild1',
    'invoke #0 mutation effect in Bar.child1',
    'invoke #1 mutation effect in Bar.child1',
    'invoke #0 mutation effect in Bar.parent',
    'invoke #1 mutation effect in Bar.parent',
    'clean ref in Foo.parent',
    'clean ref in Foo.child1',
    'clean ref in Foo.grandchild1',
    'clean ref in Foo.child2',
    'clean ref in Foo.grandchild2',
    'clean #0 layout effect in Foo.parent',
    'clean #1 layout effect in Foo.parent',
    'clean #0 layout effect in Foo.child1',
    'clean #1 layout effect in Foo.child1',
    'clean #0 layout effect in Foo.grandchild1',
    'clean #1 layout effect in Foo.grandchild1',
    'clean #0 layout effect in Foo.child2',
    'clean #1 layout effect in Foo.child2',
    'clean #0 layout effect in Foo.grandchild2',
    'clean #1 layout effect in Foo.grandchild2',
    'invoke ref in Bar.parent',
    'invoke ref in Bar.child1',
    'invoke ref in Bar.grandchild1',
    'invoke #0 layout effect in Bar.grandchild1',
    'invoke #1 layout effect in Bar.grandchild1',
    'invoke #0 layout effect in Bar.child1',
    'invoke #1 layout effect in Bar.child1',
    'invoke #0 layout effect in Bar.parent',
    'invoke #1 layout effect in Bar.parent',
    'clean #0 passive effect in Foo.parent',
    'clean #1 passive effect in Foo.parent',
    'clean #0 passive effect in Foo.child1',
    'clean #1 passive effect in Foo.child1',
    'clean #0 passive effect in Foo.grandchild1',
    'clean #1 passive effect in Foo.grandchild1',
    'clean #0 passive effect in Foo.child2',
    'clean #1 passive effect in Foo.child2',
    'clean #0 passive effect in Foo.grandchild2',
    'clean #1 passive effect in Foo.grandchild2',
    'invoke #0 passive effect in Bar.grandchild1',
    'invoke #1 passive effect in Bar.grandchild1',
    'invoke #0 passive effect in Bar.child1',
    'invoke #1 passive effect in Bar.child1',
    'invoke #0 passive effect in Bar.parent',
    'invoke #1 passive effect in Bar.parent',
  ]);

  logs.length = 0;

  await root.unmount().finished;
  await scheduler.postTask(() => {}, { priority: 'background' });

  expect(container.innerHTML).toBe('');
  expect(logs).toStrictEqual([
    'clean #0 mutation effect in Bar.parent',
    'clean #1 mutation effect in Bar.parent',
    'clean #0 mutation effect in Bar.child1',
    'clean #1 mutation effect in Bar.child1',
    'clean #0 mutation effect in Bar.grandchild1',
    'clean #1 mutation effect in Bar.grandchild1',
    'clean ref in Bar.parent',
    'clean ref in Bar.child1',
    'clean ref in Bar.grandchild1',
    'clean #0 layout effect in Bar.parent',
    'clean #1 layout effect in Bar.parent',
    'clean #0 layout effect in Bar.child1',
    'clean #1 layout effect in Bar.child1',
    'clean #0 layout effect in Bar.grandchild1',
    'clean #1 layout effect in Bar.grandchild1',
    'clean #0 passive effect in Bar.parent',
    'clean #1 passive effect in Bar.parent',
    'clean #0 passive effect in Bar.child1',
    'clean #1 passive effect in Bar.child1',
    'clean #0 passive effect in Bar.grandchild1',
    'clean #1 passive effect in Bar.grandchild1',
  ]);
});

const Foo = createComponent(function Parent({
  logs,
}: {
  logs: string[];
}): unknown {
  return Node({
    name: 'Foo.parent',
    logs,
    children: Fragment([
      Node({
        name: 'Foo.child1',
        logs,
        children: Node({ name: 'Foo.grandchild1', logs }),
      }),
      Node({
        name: 'Foo.child2',
        logs,
        children: Node({ name: 'Foo.grandchild2', logs }),
      }),
    ]),
  });
});

const Bar = createComponent(function Parent({
  logs,
}: {
  logs: string[];
}): unknown {
  return Node({
    name: 'Bar.parent',
    logs,
    children: Node({
      name: 'Bar.child1',
      logs,
      children: Node({ name: 'Bar.grandchild1', logs }),
    }),
  });
});

const Node = createComponent(function Child(
  {
    name,
    logs,
    children,
  }: {
    name: string;
    logs: string[];
    children?: unknown;
  },
  $: RenderContext,
): unknown {
  logs.push(`render ${name}`);

  $.use(TestEffects(2, name, logs));

  const ref = (element: Element) => {
    logs.push(`invoke ref in ${element.className}`);
    return () => {
      logs.push(`clean ref in ${element.className}`);
    };
  };

  return $.html`
    <div :ref=${ref} class=${name}>
      <${children}>
    </div>
  `;
});

function TestEffects(
  times: number,
  name: unknown,
  logs: string[],
): HookFunction<void> {
  return ($) => {
    for (let i = 0; i < times; i++) {
      $.useInsertionEffect(() => {
        logs.push(`invoke #${i} mutation effect in ${name}`);
        return () => {
          logs.push(`clean #${i} mutation effect in ${name}`);
        };
      });

      $.useLayoutEffect(() => {
        logs.push(`invoke #${i} layout effect in ${name}`);
        return () => {
          logs.push(`clean #${i} layout effect in ${name}`);
        };
      });

      $.useEffect(() => {
        logs.push(`invoke #${i} passive effect in ${name}`);
        return () => {
          logs.push(`clean #${i} passive effect in ${name}`);
        };
      });
    }
  };
}
