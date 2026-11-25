import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  Runtime,
  step,
} from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Effect hook', () => {
  let runtime: Runtime;
  let container: Element;
  let root: DOMRoot;

  beforeEach(() => {
    runtime = new Runtime(new DOMAdapter());
    container = document.createElement('div');
    root = new DOMRoot(runtime, container);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('runs effects in bottom-up order on mount', async () => {
    const logs: string[] = [];
    const Child = createComponent(function Child({ name }: { name: string }) {
      this.useEffect(() => {
        logs.push(`setup ${name}`);
      });
      return html`<div>${name}</div>`;
    });
    const App = createComponent(function App() {
      this.useEffect(() => {
        logs.push('setup parent');
      });
      return [Child({ name: 'child1' }), Child({ name: 'child2' })];
    });

    await root.render(App({})).finished;
    expect(logs).toStrictEqual([
      'setup child1',
      'setup child2',
      'setup parent',
    ]);
  });

  it('re-runs the effect when dependencies change', async () => {
    const logs: string[] = [];
    const App = createComponent(function App({ value }: { value: number }) {
      this.useEffect(() => {
        logs.push(`setup ${value}`);
        return () => {
          logs.push(`cleanup ${value}`);
        };
      }, [value]);
      return html`<div>${value}</div>`;
    });

    await root.render(App({ value: 1 })).finished;
    expect(logs).toStrictEqual(['setup 1']);

    await root.render(App({ value: 2 })).finished;
    expect(logs).toStrictEqual(['setup 1', 'cleanup 1', 'setup 2']);
  });

  it('skips the effect when dependencies are unchanged on re-render', async () => {
    const logs: string[] = [];
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      this.useEffect(() => {
        logs.push('effect');
      }, []);
      return html`
        <button
          @click=${() => setCount(count + 1)}
        >
          ${count}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('0');
    expect(logs).toStrictEqual(['effect']);

    button.click();
    await step(runtime);
    expect(button.textContent).toBe('1');
    expect(logs).toStrictEqual(['effect']);
  });

  it('cleans up the effect in top-down on unmount', async () => {
    const logs: string[] = [];
    const Child = createComponent(function Child({ name }: { name: string }) {
      this.useEffect(() => {
        return () => {
          logs.push(`cleanup ${name}`);
        };
      });
      return html`<div>${name}</div>`;
    });
    const App = createComponent(function App() {
      this.useEffect(() => {
        return () => {
          logs.push('cleanup parent');
        };
      });
      return [Child({ name: 'child1' }), Child({ name: 'child2' })];
    });

    await root.render(App({})).finished;
    expect(logs).toStrictEqual([]);

    await root.unmount().finished;
    expect(logs).toStrictEqual([
      'cleanup parent',
      'cleanup child1',
      'cleanup child2',
    ]);
  });

  it('handles update scheduled during effect cleanup gracefully', async () => {
    const log: string[] = [];
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      this.useEffect(() => {
        log.push('setup');
        return () => {
          log.push('cleanup');
          setCount(999);
        };
      });
      return html`<div>${count}</div>`;
    });

    await root.render(App({})).finished;
    expect(log).toStrictEqual(['setup']);

    await root.unmount().finished;
    expect(log).toStrictEqual(['setup', 'cleanup']);

    await step(runtime);
    expect(container.innerHTML).toBe('');
  });

  it('re-runs the effect when state is updated during setup', async () => {
    const logs: string[] = [];
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      this.useEffect(() => {
        if (count === 0) {
          setCount(count + 1);
        }
        logs.push(`setup ${count}`);
        return () => {
          logs.push(`cleanup ${count}`);
        };
      }, [count]);
      return html`<div>${count}</div>`;
    });

    await root.render(App({})).finished;
    expect(logs).toStrictEqual(['setup 0']);

    await step(runtime);
    expect(logs).toStrictEqual(['setup 0', 'cleanup 0', 'setup 1']);
  });
});
