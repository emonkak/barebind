import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  Runtime,
  step,
  type UpdateHandle,
} from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('State hook', () => {
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

  it('updates the state with the new value', async () => {
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      return html`
        <button
          @click=${() => {
            setCount(count + 1);
          }}
        >
          ${count}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('0');

    button.click();
    await step(runtime);
    expect(button.textContent).toBe('1');
  });

  it('updates the state with the updater function', async () => {
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      return html`
        <button
          @click=${() => {
            setCount((count) => count + 1);
          }}
        >
          ${count}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('0');

    button.click();
    await step(runtime);
    expect(button.textContent).toBe('1');
  });

  it('updates the state with the reducer function', async () => {
    const App = createComponent(function App() {
      const [count, increment] = this.useReducer<number, number>(
        (count, n) => count + n,
        0,
      );
      return html`
        <button
          @click=${() => {
            increment(1);
          }}
        >
          ${count}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('0');

    button.click();
    await step(runtime);
    expect(button.textContent).toBe('1');
  });

  it('updates parent state via callback from memoized child component', async () => {
    const Child = createComponent(function Child({
      onIncrement,
    }: {
      onIncrement: () => void;
    }) {
      const [count, setCount] = this.useState(0);
      return html`
        <button @click=${() => {
          setCount((count) => count + 1);
          onIncrement();
        }}>
          ${count}
        </button>
      `;
    });
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      return html`
        <div>
          <span>${count}</span>
          <${this.useMemo(
            () =>
              Child({
                onIncrement: () => {
                  setCount((count) => count + 1);
                },
              }),
            [],
          )}>
        </div>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(container.innerHTML).toBe(
      '<div><span>0</span><button>0</button><!----></div>',
    );

    button.click();
    await step(runtime);
    expect(container.innerHTML).toBe(
      '<div><span>1</span><button>1</button><!----></div>',
    );
  });

  it('skips re-render when the state is unchanged', async () => {
    let renderCount = 0;

    const App = createComponent(function App() {
      renderCount++;
      const [count, setCount] = this.useState(123);
      return html`
        <button
          @click=${() => {
            setCount(123);
          }}
        >
          ${count}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(renderCount).toBe(1);
    expect(button.textContent).toBe('123');

    button.click();
    await step(runtime);
    expect(renderCount).toBe(1);
    expect(button.textContent).toBe('123');
  });

  it('skips re-render with custom areStatesEqual()', async () => {
    let renderCount = 0;

    const App = createComponent(function App() {
      renderCount++;
      const [state, setState] = this.useState({ value: 1 });
      return html`
        <button
          @click=${() =>
            setState(
              { value: 1 },
              {
                areStatesEqual: (a, b) => a.value === b.value,
              },
            )}
        >
          ${state.value}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(renderCount).toBe(1);
    expect(button.textContent).toBe('1');

    button.click();
    await step(runtime);
    expect(renderCount).toBe(1);
    expect(button.textContent).toBe('1');
  });

  it('initializes the state with a function', async () => {
    const App = createComponent(function App() {
      const [count] = this.useState(() => 123);
      return html`<div>${count}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>123</div>');
  });

  it('reinitializes the state from props with passthrough', async () => {
    const App = createComponent(function App({ value }: { value: string }) {
      const [state] = this.useState(value, { passthrough: true });
      return html`<div>${state}</div>`;
    });

    await root.render(App({ value: 'hello' })).finished;
    expect(container.innerHTML).toBe('<div>hello</div>');

    await root.render(App({ value: 'hi' })).finished;
    expect(container.innerHTML).toBe('<div>hi</div>');
  });

  it('handles batched updates', async () => {
    const eventTarget = new EventTarget();
    const Child = createComponent(function Child() {
      const [count, setCount] = this.useState(0);

      this.useEffect(() => {
        eventTarget.addEventListener('increment', () => {
          setCount((count) => count + 1);
        });
      }, []);

      return html`<div>${count}</div>`;
    });
    const App = createComponent(function App() {
      return [Child({}), Child({})];
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>0</div><div>0</div>');

    eventTarget.dispatchEvent(new Event('increment'));
    await step(runtime);
    expect(container.innerHTML).toBe('<div>1</div><div>1</div>');
  });

  it('handles multiple updates on the same lane', async () => {
    const App = createComponent(function App() {
      const [first, setFirst] = this.useState(0);
      const [second, setSecond] = this.useState(0);
      return html`
        <button
          @click=${() => {
            setFirst(1);
            setSecond(2);
          }}
        >
          ${first}/${second}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('0/0');

    button.click();
    await step(runtime);
    expect(button.textContent).toBe('1/2');
  });

  it('handles multiple updates on different lanes', async () => {
    const App = createComponent(function App() {
      const [first, setFirst] = this.useState(0);
      const [second, setSecond] = this.useState(0);
      return html`
        <button
          @click=${() => {
            setFirst(1, { priority: 'user-blocking' });
            setSecond(2, { priority: 'background' });
          }}
        >
          ${first}/${second}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('0/0');

    button.click();
    await step(runtime);
    expect(button.textContent).toBe('1/0');

    await step(runtime);
    expect(button.textContent).toBe('1/2');
  });

  it('handles multiple updates with the same priority on different lanes', async () => {
    const App = createComponent(function App() {
      const [first, setFirst] = this.useState(0);
      const [second, setSecond] = this.useState(0);
      return html`
        <button
          @click=${() => {
            setFirst(1, { priority: 'user-visible' });
            setSecond(2, { priority: 'user-visible', flushSync: true });
          }}
        >
          ${first}/${second}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('0/0');

    button.click();
    await step(runtime);
    expect(button.textContent).toBe('1/2');
  });

  it('handles transient dispatch with lane mismatch', async () => {
    const App = createComponent(function App() {
      const [optimisticValue, setOptimisticValue] = this.useState('initial');
      return html`
        <button
          @click=${() => {
            this.startTransition((transition) => {
              setOptimisticValue('optimistic', {
                transient: true,
                transition,
              });
            });
          }}
        >
          ${optimisticValue}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('initial');

    button.click();
    await step(runtime);
    expect(button.textContent).toBe('optimistic');

    await root.render(App({})).finished;
    await step(runtime);
    expect(button.textContent).toBe('initial');
  });

  it('handles the update during render', async () => {
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      if (count === 0) {
        setCount(100);
      }
      return html`
        <div>${count}</div>
      `;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>100</div>');
  });

  it('handles repeated state updates during render', async () => {
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      if (count < 3) {
        setCount(count + 1);
      }
      return html`
        <div>${count}</div>
      `;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>3</div>');
  });

  it('handles the update during render when props change', async () => {
    const App = createComponent(function App({
      nextCount,
    }: {
      nextCount: number;
    }) {
      const [count, setCount] = this.useState(0);
      if (count !== nextCount) {
        setCount(nextCount);
      }
      return html`
        <div>${count}</div>
      `;
    });

    await root.render(App({ nextCount: 0 })).finished;
    expect(container.innerHTML).toBe('<div>0</div>');

    await root.render(App({ nextCount: 3 })).finished;
    expect(container.innerHTML).toBe('<div>3</div>');
  });

  it('runs the effect once after repeated state updates during render are committed', async () => {
    const logs: string[] = [];
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      this.useEffect(() => {
        logs.push(container.innerHTML);
      });
      if (count < 3) {
        setCount(count + 1);
      }
      return html`
        <div>${count}</div>
      `;
    });

    await root.render(App({})).finished;
    expect(logs).toStrictEqual(['<div>3</div>']);
  });

  it('resolves UpdateHandle.finished after the state update is committed', async () => {
    let increment!: () => UpdateHandle;
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      increment = () => setCount(count + 1);
      return html`<div>${count}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>0</div>');

    await increment().finished;
    expect(container.innerHTML).toBe('<div>1</div>');
  });

  it('prevents concurrent child update when parent removes child', async () => {
    const Child = createComponent(function Child({
      onToggle,
    }: {
      onToggle: () => void;
    }) {
      const [count, setCount] = this.useState(0);
      return html`
        <button @click=${() => {
          setCount((count) => count + 1);
          onToggle();
        }}>
          ${count}
        </div>
      `;
    });
    const App = createComponent(function App() {
      const [shown, setShown] = this.useState(true);
      return shown
        ? Child({
            onToggle: () => {
              setShown((shown) => !shown);
            },
          })
        : null;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(button.innerHTML).toBe('0');

    button.click();
    await step(runtime);
    expect(button.innerHTML).toBe('0');
  });

  it('prevents subsequent child update after parent removes child', async () => {
    const Child = createComponent(function Child() {
      const [count, setCount] = this.useState(0);
      return html`
        <button @click=${() => {
          setCount((count) => count + 1);
        }}>
          ${count}
        </div>
      `;
    });
    const App = createComponent(function App({ shown }: { shown: boolean }) {
      return shown ? Child({}) : null;
    });

    await root.render(App({ shown: true })).finished;
    const button = container.querySelector('button')!;
    expect(button.innerHTML).toBe('0');

    await root.render(App({ shown: false })).finished;
    button.click();
    await step(runtime);

    expect(button.innerHTML).toBe('0');
  });
});
