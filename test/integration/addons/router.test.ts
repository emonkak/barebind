import { createComponent, DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import {
  InMemoryAdapter,
  NavigationContext,
  SyncNavigation,
} from 'barebind/addons/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Router integration', () => {
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

  it('renders initial URL and updates on navigation via RenderContext.use()', async () => {
    const adapter = new InMemoryAdapter('/home', { user: 1 });

    const App = createComponent(function App() {
      const { scene } = this.use(SyncNavigation(adapter));
      return html`<div>${scene.url}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>/home</div>');

    await adapter.navigate('/about');
    expect(container.innerHTML).toBe('<div>/about</div>');
  });

  it('exposes scene state and navigationType via NavigationContext', async () => {
    const adapter = new InMemoryAdapter('/initial', { key: 'val' });

    const App = createComponent(function App() {
      const { scene } = this.use(SyncNavigation(adapter));
      const state = scene.state as { key: string } | undefined;
      return html`<div>${scene.url}:${state?.key}:${scene.navigationType}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>/initial:val:</div>');

    await adapter.navigate('/next', { state: { key: 'next' } });
    expect(container.innerHTML).toBe('<div>/next:next:push</div>');
  });

  it('injects NavigationContext into child components', async () => {
    const adapter = new InMemoryAdapter('/parent', null);

    const Child = createComponent(function Child() {
      const { scene } = this.inject(NavigationContext);
      return html`<span>${scene.url}</span>`;
    });

    const App = createComponent(function App() {
      this.use(SyncNavigation(adapter));
      return html`<div><${Child({})}></div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div><span>/parent</span><!----></div>');

    await adapter.navigate('/child-path');
    expect(container.innerHTML).toBe(
      '<div><span>/child-path</span><!----></div>',
    );
  });
});
