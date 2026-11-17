import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  RenderContext,
  Runtime,
} from 'barebind';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Custom hook', () => {
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
