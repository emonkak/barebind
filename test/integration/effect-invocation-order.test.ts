import { expect, test } from 'vitest';

import { createComponent } from '@/component.js';
import type { CustomHookFunction, RenderContext } from '@/internal.js';
import { Root } from '@/root.js';
import { BrowserBackend } from '@/runtime/browser.js';
import { Runtime } from '@/runtime.js';
import { stripComments } from '../test-helpers.js';

test('invokes effects from child to parent', async () => {
  const logs: string[] = [];
  const value = App({ logs });
  const container = document.createElement('div');
  const root = Root.create(value, container, new Runtime(new BrowserBackend()));

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe(
    '<div class="parent"><div class="child1"><div class="grandchild1"></div></div><div class="child2"><div class="grandchild2"></div></div></div>',
  );
  expect(logs).toStrictEqual([
    'render parent',
    'render child1',
    'render child2',
    'render grandchild1',
    'render grandchild2',
    'invoke #1 mutation effect in grandchild2',
    'invoke #2 mutation effect in grandchild2',
    'invoke #1 mutation effect in grandchild1',
    'invoke #2 mutation effect in grandchild1',
    'invoke #1 mutation effect in child2',
    'invoke #2 mutation effect in child2',
    'invoke #1 mutation effect in child1',
    'invoke #2 mutation effect in child1',
    'invoke #1 mutation effect in parent',
    'invoke #2 mutation effect in parent',
    'invoke #1 layout effect in grandchild2',
    'invoke #2 layout effect in grandchild2',
    'invoke #1 layout effect in grandchild1',
    'invoke #2 layout effect in grandchild1',
    'invoke #1 layout effect in child2',
    'invoke #2 layout effect in child2',
    'invoke #1 layout effect in child1',
    'invoke #2 layout effect in child1',
    'invoke #1 layout effect in parent',
    'invoke #2 layout effect in parent',
    'invoke #1 passive effect in grandchild2',
    'invoke #2 passive effect in grandchild2',
    'invoke #1 passive effect in grandchild1',
    'invoke #2 passive effect in grandchild1',
    'invoke #1 passive effect in child2',
    'invoke #2 passive effect in child2',
    'invoke #1 passive effect in child1',
    'invoke #2 passive effect in child1',
    'invoke #1 passive effect in parent',
    'invoke #2 passive effect in parent',
  ]);

  logs.length = 0;

  await root.unmount().finished;

  expect(container.innerHTML).toBe('');
  expect(logs).toStrictEqual([
    'clean #1 mutation effect in parent',
    'clean #2 mutation effect in parent',
    'clean #1 mutation effect in child1',
    'clean #2 mutation effect in child1',
    'clean #1 mutation effect in grandchild1',
    'clean #2 mutation effect in grandchild1',
    'clean #1 mutation effect in child2',
    'clean #2 mutation effect in child2',
    'clean #1 mutation effect in grandchild2',
    'clean #2 mutation effect in grandchild2',
    'clean #1 layout effect in parent',
    'clean #2 layout effect in parent',
    'clean #1 layout effect in child1',
    'clean #2 layout effect in child1',
    'clean #1 layout effect in grandchild1',
    'clean #2 layout effect in grandchild1',
    'clean #1 layout effect in child2',
    'clean #2 layout effect in child2',
    'clean #1 layout effect in grandchild2',
    'clean #2 layout effect in grandchild2',
    'clean #1 passive effect in parent',
    'clean #2 passive effect in parent',
    'clean #1 passive effect in child1',
    'clean #2 passive effect in child1',
    'clean #1 passive effect in grandchild1',
    'clean #2 passive effect in grandchild1',
    'clean #1 passive effect in child2',
    'clean #2 passive effect in child2',
    'clean #1 passive effect in grandchild2',
    'clean #2 passive effect in grandchild2',
  ]);
});

const App = createComponent(function Parent({
  logs,
}: {
  logs: string[];
}): unknown {
  return Node({
    name: 'parent',
    logs,
    children: [
      Node({
        name: 'child1',
        logs,
        children: Node({ name: 'grandchild1', logs }),
      }),
      Node({
        name: 'child2',
        logs,
        children: Node({ name: 'grandchild2', logs }),
      }),
    ],
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

  $.use(TestEffects(name, logs));

  return $.html`
    <div class=${name}>
      <${children}>
    </div>
  `;
});

function TestEffects(name: unknown, logs: string[]): CustomHookFunction<void> {
  return ($) => {
    for (const n of [1, 2]) {
      $.useInsertionEffect(() => {
        logs.push(`invoke #${n} mutation effect in ${name}`);
        return () => {
          logs.push(`clean #${n} mutation effect in ${name}`);
        };
      });
    }

    for (const n of [1, 2]) {
      $.useLayoutEffect(() => {
        logs.push(`invoke #${n} layout effect in ${name}`);
        return () => {
          logs.push(`clean #${n} layout effect in ${name}`);
        };
      });
    }

    for (const n of [1, 2]) {
      $.useEffect(() => {
        logs.push(`invoke #${n} passive effect in ${name}`);
        return () => {
          logs.push(`clean #${n} passive effect in ${name}`);
        };
      });
    }
  };
}
