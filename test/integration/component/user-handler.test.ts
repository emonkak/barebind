import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  Runtime,
  step,
} from 'barebind';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommitHandler } from '@/base.js';

describe('User handler', () => {
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

  it('commits the update with the user handler', async () => {
    const handler = vi.fn((commit) => {
      return Promise.resolve().then(commit);
    });
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      return html`
        <button
          @click=${() => {
            setCount(count + 1, {
              handler,
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
    expect(handler).not.toHaveBeenCalled();

    button.click();
    await step(runtime);
    expect(button.innerHTML).toBe('1');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.any(Function));
  });

  it('commits multiple user handlers in a single batch', async () => {
    const handler1 = vi.fn((commit) => {
      return Promise.resolve().then(commit);
    });
    const handler2 = vi.fn((commit) => {
      return Promise.resolve().then(commit);
    });
    const Counter = createComponent(function Counter({
      handler,
      dispatcher,
    }: {
      handler: CommitHandler;
      dispatcher: EventTarget;
    }) {
      const [count, setCount] = this.useState(0);
      this.useEffect(() => {
        const listener = () => {
          setCount((count) => count + 1, { handler });
        };
        dispatcher.addEventListener('increment', listener);
        return () => {
          dispatcher.removeEventListener('increment', listener);
        };
      }, [dispatcher]);
      return html`
        <div>${count}</div>
      `;
    });

    const dispatcher = new EventTarget();
    await root.render([
      Counter({ dispatcher, handler: handler1 }),
      Counter({ dispatcher, handler: handler2 }),
    ]).finished;
    expect(container.innerHTML).toBe('<div>0</div><div>0</div>');
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();

    dispatcher.dispatchEvent(new CustomEvent('increment'));
    await step(runtime);
    expect(container.innerHTML).toBe('<div>1</div><div>1</div>');
    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });
});
