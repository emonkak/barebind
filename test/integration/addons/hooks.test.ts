import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  Ref,
  Runtime,
  step,
} from 'barebind';
import {
  DeferredValue,
  EffectEvent,
  ImperativeHandle,
  SyncExternalStore,
  Transition,
} from 'barebind/addons/hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Hooks addon', () => {
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

  describe('DeferredValue', () => {
    it('returns the current value initially and defers subsequent updates', async () => {
      const App = createComponent(function App({ value }: { value: string }) {
        const deferredValue = this.use(DeferredValue(value));
        return html`<div>${deferredValue}</div>`;
      });

      await root.render(App({ value: 'a' })).finished;
      expect(container.innerHTML).toBe('<div>a</div>');

      await root.render(App({ value: 'b' })).finished;
      expect(container.innerHTML).toBe('<div>a</div>');

      await step(runtime);
      expect(container.innerHTML).toBe('<div>b</div>');
    });

    it('uses initialValue when provided', async () => {
      const App = createComponent(function App({ value }: { value: string }) {
        const deferredValue = this.use(
          DeferredValue(value, { initialValue: 'initial' }),
        );
        return html`<div>${deferredValue}</div>`;
      });

      await root.render(App({ value: 'a' })).finished;
      expect(container.innerHTML).toBe('<div>initial</div>');

      await step(runtime);
      expect(container.innerHTML).toBe('<div>a</div>');
    });
  });

  describe('EffectEvent', () => {
    it('always calls the latest callback', async () => {
      const logs: number[] = [];
      const App = createComponent(function App({ value }: { value: number }) {
        const onClick = this.use(
          EffectEvent(() => {
            logs.push(value);
          }),
        );
        return html`<button @click=${onClick}>click</button>`;
      });

      await root.render(App({ value: 1 })).finished;
      container.querySelector('button')!.click();
      expect(logs).toStrictEqual([1]);

      await root.render(App({ value: 2 })).finished;
      container.querySelector('button')!.click();
      expect(logs).toStrictEqual([1, 2]);
    });
  });

  describe('ImperativeHandle', () => {
    it('sets ref.current on mount and clears on unmount', async () => {
      const ref = new Ref<{ method: () => string } | null>(null);
      const App = createComponent(function App() {
        this.use(ImperativeHandle(ref, () => ({ method: () => 'hello' })));
        return html`<div>content</div>`;
      });

      await root.render(App({})).finished;
      expect(ref.current).not.toBe(null);
      expect(ref.current!.method()).toBe('hello');

      await root.unmount().finished;
      expect(ref.current).toBe(null);
    });

    it('works with a function ref', async () => {
      const ref = vi.fn();
      const App = createComponent(function App() {
        this.use(ImperativeHandle(ref, () => 'handle'));
        return html`<div>content</div>`;
      });

      await root.render(App({})).finished;
      expect(ref).toHaveBeenCalledOnce();
      expect(ref).toHaveBeenCalledWith('handle');
    });
  });

  describe('SyncExternalStore', () => {
    it('returns the current snapshot and re-renders on store changes', async () => {
      let value = 0;
      let subscriber: (() => void) | null = null;
      const subscribe = vi.fn((callback: () => void) => {
        subscriber = callback;
        return () => {
          subscriber = null;
        };
      });
      const getSnapshot = vi.fn(() => value);

      const App = createComponent(function App() {
        const snapshot = this.use(SyncExternalStore(subscribe, getSnapshot));
        return html`<div>${snapshot}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>0</div>');
      expect(subscribe).toHaveBeenCalledOnce();

      value = 1;
      subscriber!();
      await step(runtime);
      expect(container.innerHTML).toBe('<div>1</div>');
    });

    it('detects snapshot changes between render and effect execution', async () => {
      const subscribe = vi.fn();
      const getSnapshot = vi
        .fn()
        .mockReturnValueOnce('initial')
        .mockReturnValue('updated');

      const App = createComponent(function App() {
        const snapshot = this.use(SyncExternalStore(subscribe, getSnapshot));
        return html`<div>${snapshot}</div>`;
      });

      await root.render(App({})).finished;
      await step(runtime);
      expect(container.innerHTML).toBe('<div>updated</div>');
    });

    it('unsubscribes on unmount', async () => {
      let subscriber: (() => void) | null = null;
      const subscribe = vi.fn((cb: () => void) => {
        subscriber = cb;
        return () => {
          subscriber = null;
        };
      });

      const App = createComponent(function App() {
        this.use(SyncExternalStore(subscribe, () => 0));
        return html`<div>content</div>`;
      });

      await root.render(App({})).finished;
      expect(subscriber).not.toBe(null);

      await root.unmount().finished;
      expect(subscriber).toBe(null);
    });
  });

  describe('Transition', () => {
    it('starts with isPending as false', async () => {
      const App = createComponent(function App() {
        const [isPending] = this.use(Transition());
        return html`<div>${isPending}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>false</div>');
    });

    it('transitions isPending to true when the transition is pending', async () => {
      const App = createComponent(function App() {
        const [isPending, startTransition] = this.use(Transition());
        return html`
          <button
            @click=${() => {
              startTransition((transition) => {
                this.forceUpdate({ transition });
              });
            }}
          >
            ${isPending}
          </button>
        `;
      });

      await root.render(App({})).finished;
      const button = container.querySelector('button')!;

      button.click();
      await step(runtime);
      expect(container.innerHTML).toBe('<button>true</button>');

      await step(runtime);
      expect(container.innerHTML).toBe('<button>false</button>');
    });

    it('keeps isPending to true until the promise is fulfilled', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const App = createComponent(function App() {
        const [isPending, startTransition] = this.use(Transition());
        return html`
          <button
            @click=${() => {
              startTransition(() => promise);
            }}
          >
            ${isPending}
          </button>
        `;
      });

      await root.render(App({})).finished;
      const button = container.querySelector('button')!;

      button.click();
      await step(runtime);
      expect(container.innerHTML).toBe('<button>true</button>');

      resolve();
      await promise;
      await step(runtime);
      expect(container.innerHTML).toBe('<button>false</button>');
    });
  });
});
