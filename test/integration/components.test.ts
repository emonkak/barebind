import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  Ref,
  RenderContext,
  RenderError,
  Runtime,
  step,
  type UpdateHandle,
} from 'barebind';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('components', () => {
  let container: Element;
  let runtime: Runtime;
  let root: DOMRoot;

  beforeEach(() => {
    container = document.createElement('div');
    runtime = new Runtime(new DOMAdapter());
    root = new DOMRoot(container, runtime);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('render', () => {
    it('renders the props passed as an argument', async () => {
      const App = createComponent(function App({
        message,
      }: {
        message: string;
      }) {
        return html`<div>${message}</div>`;
      });

      await root.render(App({ message: 'hello' })).finished;
      expect(container.innerHTML).toBe('<div>hello</div>');
    });

    it('re-renders when the props change', async () => {
      const App = createComponent(function App({ value }: { value: number }) {
        return html`<div>${value}</div>`;
      });

      await root.render(App({ value: 1 })).finished;
      expect(container.innerHTML).toBe('<div>1</div>');

      await root.render(App({ value: 2 })).finished;
      expect(container.innerHTML).toBe('<div>2</div>');
    });

    it('skips re-render when arePropsEqual() returns true', async () => {
      let renderCount = 0;
      const App = createComponent(
        function App() {
          renderCount++;
          return html`<div>hello</div>`;
        },
        { arePropsEqual: () => true },
      );

      await root.render(App({})).finished;
      expect(renderCount).toBe(1);

      await root.render(App({ value: 1 })).finished;
      expect(renderCount).toBe(1);
    });

    it('reuses component instances after reorder with internal state update', async () => {
      const Item = createComponent(
        function (this: RenderContext, { id }: { id: string }) {
          const [count, setCount] = this.useState(0);
          return html`
            <button
              id=${id}
              @click=${() => {
                setCount((count) => count + 1);
              }}
            >
              ${count}
            </button>`;
        },
        { arePropsEqual: () => true },
      );
      const render = (ids: string[]) =>
        html`<div><${ids.map((id) => Item({ id }).withKey(id))}></div>`;

      await root.render(render(['a', 'b'])).finished;
      expect(container.innerHTML).toBe(
        '<div><button id="a">0</button><button id="b">0</button><!----></div>',
      );

      await root.render(render(['b', 'a'])).finished;
      expect(container.innerHTML).toBe(
        '<div><button id="b">0</button><button id="a">0</button><!----></div>',
      );

      container.querySelector<HTMLElement>('#b')?.click();
      await step(runtime);
      expect(container.innerHTML).toBe(
        '<div><button id="b">1</button><button id="a">0</button><!----></div>',
      );

      await root.render(render(['b', 'a'])).finished;
      expect(container.innerHTML).toBe(
        '<div><button id="b">1</button><button id="a">0</button><!----></div>',
      );
    });

    it('throws RenderError on render exception', async () => {
      const Child = createComponent(function Child() {
        throw new Error('fail');
      });
      const App = createComponent(function App() {
        return Child({});
      });

      let caughtError!: Error;
      try {
        await root.render(App({})).finished;
      } catch (error: any) {
        caughtError = error;
      }
      expect(caughtError).toBeInstanceOf(RenderError);
      expect(caughtError!.message).toBe(
        [
          'An error occurred during rendering.',
          DOMRoot.name,
          `\`- ${App.name}`,
          `   \`- ${Child.name} <- ERROR occurred here!`,
        ].join('\n'),
      );
      expect(caughtError!.cause).toBeInstanceOf(Error);
      expect((caughtError!.cause as Error).message).toBe('fail');
    });

    it('throws RenderError on mismatched hook types', async () => {
      const App = createComponent(function App({ first }: { first: boolean }) {
        if (first) {
          this.useId();
          this.useEffect(() => {});
        } else {
          this.useEffect(() => {});
          this.useId();
        }
        return html`<div>hello</div>`;
      });

      await root.render(App({ first: true })).finished;

      let caughtError!: Error;
      try {
        await root.render(App({ first: false })).finished;
      } catch (error: any) {
        caughtError = error;
      }
      expect(caughtError).toBeInstanceOf(RenderError);
      expect(caughtError!.message).toBe(
        [
          'An error occurred during rendering.',
          DOMRoot.name,
          `\`- ${App.name} <- ERROR occurred here!`,
        ].join('\n'),
      );
      expect(caughtError!.cause).toBeInstanceOf(Error);
      expect((caughtError!.cause as Error).message).toContain(
        'Unexpected hook type.',
      );
    });
  });

  describe('context', () => {
    class Context {
      value: unknown;
      constructor(value: unknown) {
        this.value = value;
      }
    }

    class ContextWithDefault {
      static getDefault(): ContextWithDefault {
        return new ContextWithDefault('default');
      }
      value: unknown;
      constructor(value: unknown) {
        this.value = value;
      }
    }

    it('injects the instance provided by itself', async () => {
      const App = createComponent(function App() {
        this.provide(new Context('hello'));
        const context = this.inject(Context);
        return html`<div>${context.value}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>hello</div>');
    });

    it('injects the last provided instance', async () => {
      const App = createComponent(function App() {
        this.provide(new Context('first'));
        this.provide(new Context('second'));
        const context = this.inject(Context);
        return html`<div>${context.value}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>second</div>');
    });

    it('injects the instance provided by the parent', async () => {
      const Child = createComponent(function Child() {
        const context = this.inject(Context);
        return html`<div>${context.value}</div>`;
      });
      const App = createComponent(function App() {
        this.provide(new Context('hello'));
        return Child({});
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>hello</div>');
    });

    it('injects the instance provided by the nearest parent', async () => {
      const GrandChild = createComponent(function GrandChild() {
        const context = this.inject(Context);
        return html`<div>${context.value}</div>`;
      });
      const Child = createComponent(function Child() {
        this.provide(new Context('child'));
        return GrandChild({});
      });
      const App = createComponent(function app() {
        this.provide(new Context('parent'));
        return Child({});
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>child</div>');
    });

    it('injects the default instance from getDefault()', async () => {
      const App = createComponent(function Child() {
        const context = this.inject(ContextWithDefault);
        return html`<div>${context.value}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>default</div>');
    });

    it('injects the instance after rendering', async () => {
      let context: Context | undefined;
      const App = createComponent(function App() {
        this.provide(new Context('a'));
        this.useEffect(() => {
          context = this.inject(Context);
        });
        return null;
      });

      await root.render(App({})).finished;
      expect(context?.value).toBe('a');
    });

    it('inherits the latest instance in child updates', async () => {
      const Child = createComponent(function Child() {
        const context = this.inject(Context);
        return html`
          <button
            @click=${() => {
              this.forceUpdate();
            }}
          >
            ${context.value}
          </button>
        `;
      });
      const App = createComponent(function App({ value }: { value: unknown }) {
        this.provide(new Context(value));
        return Child({});
      });

      await root.render(App({ value: 'first' })).finished;
      const button = container.querySelector('button')!;
      expect(container.innerHTML).toBe('<button>first</button>');

      await root.render(App({ value: 'second' })).finished;
      expect(container.innerHTML).toBe('<button>second</button>');

      button.click();
      await step(runtime);
      expect(container.innerHTML).toBe('<button>second</button>');
    });

    it('throws when injectable is not found', async () => {
      const App = createComponent(function App() {
        this.inject(class {});
        return html`<div>unreachable</div>`;
      });

      await expect(root.render(App({})).finished).rejects.toThrow(RenderError);
    });

    it('throws when providing the instance after rendering', async () => {
      const App = createComponent(function App() {
        this.useEffect(() => {
          this.provide(new Context('a'));
        });
        return null;
      });

      await expect(root.render(App({})).finished).rejects.toThrow(TypeError);
    });
  });

  describe('state hooks', () => {
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
      expect(container.innerHTML).toBe('<div>0</div>');

      await step(runtime);
      expect(container.innerHTML).toBe('<div>100</div>');
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

  describe('effect hooks', () => {
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
  });

  describe('performance hooks', () => {
    it('memoizes computed values', async () => {
      const App = createComponent(function App({ value }: { value: number }) {
        const doubled = this.useMemo(() => value * 2, [value]);
        return html`<div>${doubled}</div>`;
      });

      await root.render(App({ value: 1 })).finished;
      expect(container.innerHTML).toBe('<div>2</div>');

      await root.render(App({ value: 2 })).finished;
      expect(container.innerHTML).toBe('<div>4</div>');
    });

    it('reuses memoized value when deps are unchanged', async () => {
      let computeCount = 0;
      const App = createComponent(function App({ value }: { value: number }) {
        const computed = this.useMemo(() => {
          computeCount++;
          return value * 2;
        }, [value]);
        return html`<div>${computed}</div>`;
      });

      await root.render(App({ value: 1 })).finished;
      expect(computeCount).toBe(1);

      await root.render(App({ value: 1 })).finished;
      expect(computeCount).toBe(1);
    });

    it('memoizes callbacks', async () => {
      const callbacks: (() => string)[] = [];
      const App = createComponent(function App() {
        const callback = this.useCallback(() => 'hello', []);
        callbacks.push(callback);
        return html`<div>hello</div>`;
      });

      await root.render(App({})).finished;
      await root.render(App({})).finished;
      expect(callbacks).toHaveLength(2);
      expect(callbacks[0]).toBe(callbacks[1]);
    });
  });

  describe('ref hooks', () => {
    it('provides stable ref', async () => {
      const refs: { current: number }[] = [];
      const App = createComponent(function App() {
        const ref = this.useRef(refs.length);
        refs.push(ref);
        return html`<div>hello</div>`;
      });

      await root.render(App({})).finished;
      expect(refs.length).toBe(1);
      expect(refs[0]!.current).toBe(0);

      await root.render(App({})).finished;
      expect(refs.length).toBe(2);
      expect(refs[1]).toBe(refs[0]);
      expect(refs[1]!.current).toBe(0);
    });

    it('holds the DOM node on mount', async () => {
      let ref!: Ref<HTMLDivElement | null>;
      const App = createComponent(function App() {
        ref = this.useRef<HTMLDivElement | null>(null);
        return html`<div ${ref}>hello</div>`;
      });

      await root.render(App({})).finished;
      expect(ref).toBeInstanceOf(Ref);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toBe(container.querySelector('div'));
    });

    it('holds the DOM node before commit effects', async () => {
      let element!: HTMLDivElement;
      const App = createComponent(function App() {
        const ref = this.useRef<HTMLDivElement | null>(null);
        this.useEffect(() => {
          element = ref.current!;
        });
        return html`<div ${ref}>hello</div>`;
      });

      await root.render(App({})).finished;
      expect(element).toBeInstanceOf(HTMLDivElement);
      expect(element).toBe(container.querySelector('div'));
    });

    it('holds the DOM node before clean up effects', async () => {
      let element!: HTMLDivElement;
      const App = createComponent(function App() {
        const ref = this.useRef<HTMLDivElement | null>(null);
        this.useEffect(() => {
          return () => {
            element = ref.current!;
          };
        });
        return html`<div ${ref}>hello</div>`;
      });

      await root.render(App({})).finished;
      const target = container.querySelector('div');

      await root.unmount().finished;
      expect(element).toBeInstanceOf(HTMLDivElement);
      expect(element).toBe(target);
    });

    it('unholds the DOM node on unmount', async () => {
      let ref!: Ref<HTMLDivElement | null>;
      const App = createComponent(function App() {
        ref = this.useRef<HTMLDivElement | null>(null);
        return html`<div ${ref}>hello</div>`;
      });

      await root.render(App({})).finished;

      await root.unmount().finished;
      expect(ref).toBeInstanceOf(Ref);
      expect(ref.current).toBe(null);
    });
  });

  describe('id hooks', () => {
    it('generates unique ids', async () => {
      const App = createComponent(function App() {
        const id = this.useId();
        return html`<div id=${id}>test</div>`;
      });

      await root.render(App({})).finished;
      const target = container.querySelector('div')!;
      const id = target.id;
      expect(id).toMatch(/^[a-z0-9]+-\d+$/);

      await root.render(App({})).finished;
      expect(container.querySelector('div')!).toBe(target);
      expect(target.id).toBe(id);
    });
  });

  describe('usable functions/objects', () => {
    it('calls a usable function with the render context', async () => {
      const usable = vi.fn().mockReturnValue('hello');
      const App = createComponent(function App() {
        const message = this.use(usable);
        return html`<div>${message}</div>`;
      });

      await root.render(App({})).finished;
      expect(usable).toHaveBeenCalledOnce();
      expect(usable).toHaveBeenCalledWith(expect.any(RenderContext));
      expect(container.innerHTML).toBe('<div>hello</div>');
    });

    it('calls a usable object with the render context', async () => {
      const usable = { onUse: vi.fn().mockReturnValue('hello') };
      const App = createComponent(function App() {
        const message = this.use(usable);
        return html`<div>${message}</div>`;
      });

      await root.render(App({})).finished;
      expect(usable.onUse).toHaveBeenCalledOnce();
      expect(usable.onUse).toHaveBeenCalledWith(expect.any(RenderContext));
      expect(container.innerHTML).toBe('<div>hello</div>');
    });
  });

  describe('transitions', () => {
    it('starts transitions in unique lanes', async () => {
      const handles: UpdateHandle[] = [];
      const App = createComponent(function App() {
        const [transition, setTransition] = this.useState(-1);
        return html`
          <button
            @click=${() => {
              handles.push(
                this.startTransition((transition) =>
                  setTransition(transition, { flushSync: true, transition }),
                ),
              );
            }}>${transition}</button>
        `;
      });

      await root.render(App({})).finished;
      const button = container.querySelector<HTMLButtonElement>('button')!;
      expect(button.textContent).toBe('-1');

      for (let i = 0; i < 24; i++) {
        button.click();
        await step(runtime);
        expect(button.textContent).toBe(i.toString());
      }

      expect(new Set(handles.map((handle) => handle.lanes)).size).toBe(24);
    });
  });

  describe('view transitions', () => {
    afterEach(() => {
      document.activeViewTransition?.skipTransition();
    });

    it('commits the update in the view transition', async () => {
      const App = createComponent(function App() {
        const [count, setCount] = this.useState(0);
        return html`
          <button
            @click=${() => {
              setCount(count + 1, { viewTransition: true });
            }}
          >
            ${count}
          </button>
        `;
      });

      await root.render(App({})).finished;
      const button = container.querySelector('button')!;
      expect(button.innerHTML).toBe('0');
      expect(document.activeViewTransition).toBe(null);

      button.click();
      await step(runtime);
      expect(button.innerHTML).toBe('1');
      expect(document.activeViewTransition).toBeInstanceOf(ViewTransition);
      expect([...document.activeViewTransition!.types]).toStrictEqual([]);
    });

    it('commits the update with in view transition with types', async () => {
      const App = createComponent(function App() {
        const [count, setCount] = this.useState(0);
        return html`
          <button
            @click=${() => {
              setCount(count + 1, {
                viewTransition: ['slide', 'fade'],
              });
            }}
          >
            ${count}
          </button>
        `;
      });

      await root.render(App({})).finished;
      const button = container.querySelector('button')!;
      expect(button.innerHTML).toBe('0');
      expect(document.activeViewTransition).toBe(null);

      button.click();
      await step(runtime);
      expect(button.innerHTML).toBe('1');
      expect(document.activeViewTransition).toBeInstanceOf(ViewTransition);
      expect([...document.activeViewTransition!.types]).toStrictEqual([
        'slide',
        'fade',
      ]);
    });
  });
});
