import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  Runtime,
  type UpdateHandle,
  type UpdateOptions,
} from 'barebind';
import {
  InMemoryAdapter,
  NavigationContext,
  type NavigationScene,
  SyncNavigation,
} from 'barebind/addons/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Router addon', () => {
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

  it('falls back to the default handler when intercept returns undefined', async () => {
    const adapter = new InMemoryAdapter('/home', null);

    const App = createComponent(function App() {
      const { scene } = this.use(SyncNavigation(adapter, () => undefined));
      return html`<div>${scene.url}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>/home</div>');

    await adapter.navigate('/about');
    expect(container.innerHTML).toBe('<div>/about</div>');
  });

  it('passes the pending scene and setScene to the intercept callback', async () => {
    const adapter = new InMemoryAdapter('/home', null);
    const intercept = vi.fn(
      (
        scene: NavigationScene,
        setScene: (
          scene: NavigationScene,
          options: UpdateOptions,
        ) => UpdateHandle,
      ) => ({
        handler: () => setScene(scene, {}).finished,
      }),
    );

    const App = createComponent(function App() {
      const { scene } = this.use(SyncNavigation(adapter, intercept));
      return html`<div>${scene.url}</div>`;
    });

    await root.render(App({})).finished;
    await adapter.navigate('/about', { state: { key: 'next' } });

    expect(intercept).toHaveBeenCalledTimes(1);
    expect(intercept).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/about',
        state: { key: 'next' },
        navigationType: 'push',
      }),
      expect.any(Function),
    );
    expect(container.innerHTML).toBe('<div>/about</div>');
  });
});
