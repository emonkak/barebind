import { expect, test } from 'vitest';

import { createComponent } from '@/component.js';
import type { HookFunction, RenderContext } from '@/internal.js';
import { Root } from '@/root.js';
import { BrowserBackend } from '@/runtime/browser.js';
import { Runtime } from '@/runtime.js';
import { Fragment } from '@/template.js';
import { stripComments, waitUntilIdle } from '../test-helpers.js';

test('invokes effects from child to parent', async () => {
  const logs: string[] = [];
  const container = document.createElement('div');
  const root = Root.create<unknown>(
    Foo({ logs }),
    container,
    new Runtime(new BrowserBackend()),
  );

  await root.mount().finished;
  await waitUntilIdle();

  expect(stripComments(container).innerHTML).toBe(
    '<div class="Foo"><div class="Foo.0"><div class="Foo.0.0"></div></div><div class="Foo.1"><div class="Foo.1.0"></div></div></div>',
  );
  expect(logs).toStrictEqual([
    'render Foo',
    'render Foo.0',
    'render Foo.1',
    'render Foo.0.0',
    'render Foo.1.0',
    'invoke #0 mutation effect in Foo.0.0',
    'invoke #1 mutation effect in Foo.0.0',
    'invoke #0 mutation effect in Foo.1.0',
    'invoke #1 mutation effect in Foo.1.0',
    'invoke #0 mutation effect in Foo.0',
    'invoke #1 mutation effect in Foo.0',
    'invoke #0 mutation effect in Foo.1',
    'invoke #1 mutation effect in Foo.1',
    'invoke #0 mutation effect in Foo',
    'invoke #1 mutation effect in Foo',
    'invoke ref in Foo',
    'invoke ref in Foo.0',
    'invoke ref in Foo.1',
    'invoke ref in Foo.0.0',
    'invoke ref in Foo.1.0',
    'invoke #0 layout effect in Foo.0.0',
    'invoke #1 layout effect in Foo.0.0',
    'invoke #0 layout effect in Foo.1.0',
    'invoke #1 layout effect in Foo.1.0',
    'invoke #0 layout effect in Foo.0',
    'invoke #1 layout effect in Foo.0',
    'invoke #0 layout effect in Foo.1',
    'invoke #1 layout effect in Foo.1',
    'invoke #0 layout effect in Foo',
    'invoke #1 layout effect in Foo',
    'invoke #0 passive effect in Foo.0.0',
    'invoke #1 passive effect in Foo.0.0',
    'invoke #0 passive effect in Foo.1.0',
    'invoke #1 passive effect in Foo.1.0',
    'invoke #0 passive effect in Foo.0',
    'invoke #1 passive effect in Foo.0',
    'invoke #0 passive effect in Foo.1',
    'invoke #1 passive effect in Foo.1',
    'invoke #0 passive effect in Foo',
    'invoke #1 passive effect in Foo',
  ]);

  logs.length = 0;

  await root.update(Bar({ logs })).finished;
  await waitUntilIdle();

  expect(stripComments(container).innerHTML).toBe(
    '<div class="Bar"><div class="Bar.0"><div class="Bar.0.0"></div></div></div>',
  );
  expect(logs).toStrictEqual([
    'render Bar',
    'render Bar.0',
    'render Bar.0.0',
    'clean #0 mutation effect in Foo',
    'clean #1 mutation effect in Foo',
    'clean #0 mutation effect in Foo.0',
    'clean #1 mutation effect in Foo.0',
    'clean #0 mutation effect in Foo.0.0',
    'clean #1 mutation effect in Foo.0.0',
    'clean #0 mutation effect in Foo.1',
    'clean #1 mutation effect in Foo.1',
    'clean #0 mutation effect in Foo.1.0',
    'clean #1 mutation effect in Foo.1.0',
    'invoke #0 mutation effect in Bar.0.0',
    'invoke #1 mutation effect in Bar.0.0',
    'invoke #0 mutation effect in Bar.0',
    'invoke #1 mutation effect in Bar.0',
    'invoke #0 mutation effect in Bar',
    'invoke #1 mutation effect in Bar',
    'clean ref in Foo',
    'clean ref in Foo.0',
    'clean ref in Foo.0.0',
    'clean ref in Foo.1',
    'clean ref in Foo.1.0',
    'clean #0 layout effect in Foo',
    'clean #1 layout effect in Foo',
    'clean #0 layout effect in Foo.0',
    'clean #1 layout effect in Foo.0',
    'clean #0 layout effect in Foo.0.0',
    'clean #1 layout effect in Foo.0.0',
    'clean #0 layout effect in Foo.1',
    'clean #1 layout effect in Foo.1',
    'clean #0 layout effect in Foo.1.0',
    'clean #1 layout effect in Foo.1.0',
    'invoke ref in Bar',
    'invoke ref in Bar.0',
    'invoke ref in Bar.0.0',
    'invoke #0 layout effect in Bar.0.0',
    'invoke #1 layout effect in Bar.0.0',
    'invoke #0 layout effect in Bar.0',
    'invoke #1 layout effect in Bar.0',
    'invoke #0 layout effect in Bar',
    'invoke #1 layout effect in Bar',
    'clean #0 passive effect in Foo',
    'clean #1 passive effect in Foo',
    'clean #0 passive effect in Foo.0',
    'clean #1 passive effect in Foo.0',
    'clean #0 passive effect in Foo.0.0',
    'clean #1 passive effect in Foo.0.0',
    'clean #0 passive effect in Foo.1',
    'clean #1 passive effect in Foo.1',
    'clean #0 passive effect in Foo.1.0',
    'clean #1 passive effect in Foo.1.0',
    'invoke #0 passive effect in Bar.0.0',
    'invoke #1 passive effect in Bar.0.0',
    'invoke #0 passive effect in Bar.0',
    'invoke #1 passive effect in Bar.0',
    'invoke #0 passive effect in Bar',
    'invoke #1 passive effect in Bar',
  ]);

  logs.length = 0;

  await root.unmount().finished;
  await waitUntilIdle();

  expect(container.innerHTML).toBe('');
  expect(logs).toStrictEqual([
    'clean #0 mutation effect in Bar',
    'clean #1 mutation effect in Bar',
    'clean #0 mutation effect in Bar.0',
    'clean #1 mutation effect in Bar.0',
    'clean #0 mutation effect in Bar.0.0',
    'clean #1 mutation effect in Bar.0.0',
    'clean ref in Bar',
    'clean ref in Bar.0',
    'clean ref in Bar.0.0',
    'clean #0 layout effect in Bar',
    'clean #1 layout effect in Bar',
    'clean #0 layout effect in Bar.0',
    'clean #1 layout effect in Bar.0',
    'clean #0 layout effect in Bar.0.0',
    'clean #1 layout effect in Bar.0.0',
    'clean #0 passive effect in Bar',
    'clean #1 passive effect in Bar',
    'clean #0 passive effect in Bar.0',
    'clean #1 passive effect in Bar.0',
    'clean #0 passive effect in Bar.0.0',
    'clean #1 passive effect in Bar.0.0',
  ]);
});

const Foo = createComponent(function Parent({
  logs,
}: {
  logs: string[];
}): unknown {
  return Node({
    name: 'Foo',
    logs,
    children: Fragment([
      Node({
        name: 'Foo.0',
        logs,
        children: Node({ name: 'Foo.0.0', logs }),
      }),
      Node({
        name: 'Foo.1',
        logs,
        children: Node({ name: 'Foo.1.0', logs }),
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
    name: 'Bar',
    logs,
    children: Node({
      name: 'Bar.0',
      logs,
      children: Node({ name: 'Bar.0.0', logs }),
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

  $.use(TestEffects(name, logs));

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

function TestEffects(name: unknown, logs: string[]): HookFunction<void> {
  return ($) => {
    for (let i = 0; i < 2; i++) {
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
