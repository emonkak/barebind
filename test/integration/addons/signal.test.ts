import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  Runtime,
  step,
} from 'barebind';
import {
  Atom,
  Computed,
  LocalAtom,
  LocalComputed,
} from 'barebind/addons/signal';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('signal addon', () => {
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

  describe('signal hooks', () => {
    it('renders an Atom value via use() and updates on change', async () => {
      const atom = new Atom('a');
      const App = createComponent(function App() {
        return html`<div>${this.use(atom)}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>a</div>');

      atom.value = 'b';
      await Promise.resolve();
      await step(runtime);
      expect(container.innerHTML).toBe('<div>b</div>');
    });

    it('skips redundant subscriber invocation when already batched', async () => {
      const atom = new Atom('a');
      const App = createComponent(function App() {
        return html`<div>${this.use(atom)}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>a</div>');

      atom.value = 'b';
      atom.value = 'c';
      await Promise.resolve();
      await step(runtime);
      expect(container.innerHTML).toBe('<div>c</div>');
    });

    it('renders a computed signal via use() and updates when dependencies change', async () => {
      const a = new Atom('a');
      const b = new Atom('b');
      const computed = new Computed((x, y) => `${x}-${y}`, [a, b], 'a-b');

      const App = createComponent(function App() {
        return html`<div>${this.use(computed)}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>a-b</div>');

      a.value = 'x';
      await Promise.resolve();
      await step(runtime);
      expect(container.innerHTML).toBe('<div>x-b</div>');

      b.value = 'y';
      await Promise.resolve();
      await step(runtime);
      expect(container.innerHTML).toBe('<div>x-y</div>');
    });

    it('force-updates when the signal version changes during render', async () => {
      const atom = new Atom(0);
      const App = createComponent(function App() {
        const value = this.use(atom);
        atom.value = value + 1;
        return html`<div>${value}</div>`;
      });

      await root.render(App({})).finished;
      await step(runtime);
      expect(container.innerHTML).toBe('<div>1</div>');
    });

    it('does nothing after unmount when the signal changes', async () => {
      const atom = new Atom(0);

      const App = createComponent(function App() {
        return html`<div>${this.use(atom)}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>0</div>');

      await root.unmount().finished;
      expect(container.innerHTML).toBe('');

      atom.value = 99;
      await Promise.resolve();
      expect(container.innerHTML).toBe('');
    });

    it('mutates a local Atom and re-renders', async () => {
      let localAtom: Atom<number> | undefined;

      const App = createComponent(function App() {
        localAtom = this.use(LocalAtom(0));
        return html`<div>${localAtom}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>0</div>');

      localAtom!.value = 42;
      await Promise.resolve();
      await step(runtime);
      expect(container.innerHTML).toBe('<div>42</div>');
    });

    it('creates a local Computed that updates when dependencies change', async () => {
      let a: Atom<number> | undefined;
      let b: Atom<number> | undefined;

      const App = createComponent(function App() {
        a = this.use(LocalAtom(1));
        b = this.use(LocalAtom(2));
        const sum = this.use(
          LocalComputed(() => a!.value + b!.value, [a!, b!]),
        );
        return html`<div>${sum}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>3</div>');

      a!.value = 10;
      await Promise.resolve();
      await step(runtime);
      expect(container.innerHTML).toBe('<div>12</div>');

      b!.value = 20;
      await Promise.resolve();
      await step(runtime);
      expect(container.innerHTML).toBe('<div>30</div>');
    });
  });

  describe('signal bindings', () => {
    it('renders an Atom directly as a text node', async () => {
      const atom = new Atom('hello');

      const App = createComponent(function App() {
        return html`<div>${atom}</div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div>hello</div>');

      atom.value = 'world';
      await Promise.resolve();
      await step(runtime);
      expect(container.innerHTML).toBe('<div>world</div>');
    });

    it('binds an Atom to an attribute', async () => {
      const atom = new Atom('foo');

      const App = createComponent(function App() {
        return html`<div class="${atom}"></div>`;
      });

      await root.render(App({})).finished;
      expect(container.innerHTML).toBe('<div class="foo"></div>');

      atom.value = 'bar';
      await Promise.resolve();
      await step(runtime);
      expect(container.innerHTML).toBe('<div class="bar"></div>');
    });
  });
});
