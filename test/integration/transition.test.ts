import { expect, test } from 'vitest';
import { createComponent } from '@/component.js';
import type { TransitionHandle } from '@/core.js';
import { BrowserBackend } from '@/index.js';
import { Root } from '@/root.js';
import { Runtime } from '@/runtime.js';

interface AppProps {
  tracker: AppTrakcer;
}

interface AppTrakcer {
  transition: TransitionHandle | null;
}

const App = createComponent<AppProps>(function App({ tracker }, $): unknown {
  const [x, setX] = $.useState(1);
  const [y, setY] = $.useState(2);

  const handleClick = () => {
    tracker.transition = $.startTransition((transition) => {
      setX((n) => n + 1, { priority: 'background', transition });
      setY((n) => n * 2, { priority: 'background', transition });
    });
  };

  return $.html`
    <button type="button" @click=${handleClick} data-x=${x} data-y=${y}></button>
  `;
});

test('defers commit until the transition settles', async () => {
  const tracker: AppTrakcer = { transition: null };
  const source = App({ tracker });
  const container = document.createElement('div');
  const runtime = new Runtime(new BrowserBackend());
  const root = Root.create(source, container, runtime);

  SESSION1: {
    await root.mount().finished;
  }

  expect(container.querySelector('button')?.getAttribute('data-x')).toBe('1');
  expect(container.querySelector('button')?.getAttribute('data-y')).toBe('2');

  container.querySelector('button')?.click();

  await tracker.transition?.finished;

  expect(container.querySelector('button')?.getAttribute('data-x')).toBe('2');
  expect(container.querySelector('button')?.getAttribute('data-y')).toBe('4');
});
