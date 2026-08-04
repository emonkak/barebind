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
  type Signal,
} from 'barebind/addons/signal';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Signal addon', () => {
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

  it('renders an atom value via use() and updates on change', async () => {
    const a$ = new Atom('foo');
    const App = createComponent(function App() {
      return html`<div>${this.use(a$)}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>foo</div>');

    a$.value = 'bar';
    await Promise.resolve();
    await step(runtime);
    expect(container.innerHTML).toBe('<div>bar</div>');
  });

  it('renders different signals for each rendering', async () => {
    const a$ = new Atom(0);
    const b$ = new Atom(100);

    const App = createComponent(function App({
      count$,
    }: {
      count$: Signal<number>;
    }) {
      return html`<div>${count$}</div>`;
    });

    await root.render(App({ count$: a$ })).finished;
    expect(container.innerHTML).toBe('<div>0</div>');

    a$.value++;
    await Promise.resolve();
    await step(runtime);
    expect(container.innerHTML).toBe('<div>1</div>');

    await root.render(App({ count$: b$ })).finished;
    expect(container.innerHTML).toBe('<div>100</div>');

    b$.value++;
    await Promise.resolve();
    await step(runtime);
    expect(container.innerHTML).toBe('<div>101</div>');
  });

  it('renders a computed signal via use() and updates when dependencies change', async () => {
    const a$ = new Atom('a');
    const b$ = new Atom('b');
    const c$ = new Computed((a, b) => `${a}-${b}`, [a$, b$]);

    const App = createComponent(function App() {
      return html`<div>${this.use(c$)}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>a-b</div>');

    a$.value = 'c';
    await Promise.resolve();
    await step(runtime);
    expect(container.innerHTML).toBe('<div>c-b</div>');

    b$.value = 'd';
    await Promise.resolve();
    await step(runtime);
    expect(container.innerHTML).toBe('<div>c-d</div>');
  });

  it('skips re-rendering a computed signal when the value is the same', async () => {
    const a$ = new Atom('foo');
    const b$ = new Computed((a) => a.length, [a$]);

    const App = createComponent(function App() {
      return html`<div>${this.use(b$)}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>3</div>');

    a$.value = 'bar';
    await Promise.resolve();
    expect(await step(runtime)).toBe(false);
  });

  it('skips redundant subscriber invocation when already batched', async () => {
    const a$ = new Atom('foo');
    const App = createComponent(function App() {
      return html`<div>${this.use(a$)}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>foo</div>');

    a$.value = 'bar';
    a$.value = 'baz';
    await Promise.resolve();
    await step(runtime);
    expect(container.innerHTML).toBe('<div>baz</div>');
  });

  it('re-renders when the version changes during render', async () => {
    const a$ = new Atom(0);
    const App = createComponent(function App() {
      const value = this.use(a$);
      a$.value = value + 1;
      return html`<div>${value}</div>`;
    });

    await root.render(App({})).finished;
    await step(runtime);
    expect(container.innerHTML).toBe('<div>1</div>');
  });

  it('does nothing when the value is silently written during rendering', async () => {
    const a$ = new Atom(0);
    const App = createComponent(function App() {
      const value = this.use(a$);
      a$.write(value + 1);
      return html`<div>${value}</div>`;
    });

    await root.render(App({})).finished;
    await step(runtime);
    expect(container.innerHTML).toBe('<div>0</div>');
  });

  it('does nothing after unmount when the signal changes', async () => {
    const a$ = new Atom(0);

    const App = createComponent(function App() {
      return html`<div>${this.use(a$)}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>0</div>');

    await root.unmount().finished;
    expect(container.innerHTML).toBe('');

    a$.value = 99;
    await Promise.resolve();
    expect(container.innerHTML).toBe('');
  });

  it('mutates a local Atom and re-renders', async () => {
    let a$!: Atom<number>;

    const App = createComponent(function App() {
      a$ = this.use(LocalAtom(0));
      return html`<div>${a$}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>0</div>');

    a$.value = 42;
    await Promise.resolve();
    await step(runtime);
    expect(container.innerHTML).toBe('<div>42</div>');
  });

  it('creates a local Computed that updates when dependencies change', async () => {
    let a$!: Atom<number>;
    let b$!: Atom<number>;

    const App = createComponent(function App() {
      a$ = this.use(LocalAtom(1));
      b$ = this.use(LocalAtom(2));
      const sum = this.use(
        LocalComputed(() => a$!.value + b$!.value, [a$!, b$!]),
      );
      return html`<div>${sum}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>3</div>');

    a$.value = 10;
    await Promise.resolve();
    await step(runtime);
    expect(container.innerHTML).toBe('<div>12</div>');

    b$.value = 20;
    await Promise.resolve();
    await step(runtime);
    expect(container.innerHTML).toBe('<div>30</div>');
  });
});
