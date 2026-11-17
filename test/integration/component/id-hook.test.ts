import { createComponent, DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('ID hook', () => {
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
