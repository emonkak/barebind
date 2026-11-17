import { createComponent, DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Performance hook', () => {
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
