import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  Ref,
  Runtime,
} from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Ref hook', () => {
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
      return html`<div id="target" ${ref}>hello</div>`;
    });

    await root.render(App({})).finished;
    expect(ref).toBeInstanceOf(Ref);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(container.querySelector('#target'));
  });

  it('holds the DOM node before commit effects', async () => {
    let element!: HTMLDivElement;
    const App = createComponent(function App() {
      const ref = this.useRef<HTMLDivElement | null>(null);
      this.useEffect(() => {
        element = ref.current!;
      });
      return html`<div id="target" ${ref}>hello</div>`;
    });

    await root.render(App({})).finished;
    expect(element).toBeInstanceOf(HTMLDivElement);
    expect(element).toBe(container.querySelector('#target'));
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
      return html`<div id="target" ${ref}>hello</div>`;
    });

    await root.render(App({})).finished;
    const target = container.querySelector('#target');

    await root.unmount().finished;
    expect(element).toBeInstanceOf(HTMLDivElement);
    expect(element).toBe(target);
  });

  it('holds the DOM node of the currently bound element when rebound', async () => {
    let ref!: Ref<HTMLDivElement | null>;
    const App = createComponent(function App({
      items,
      current,
    }: {
      items: string[];
      current: string;
    }) {
      ref = this.useRef<HTMLDivElement | null>(null);
      return items.map(
        (item) => html`<div ${item === current ? ref : null}>${item}</div>`,
      );
    });

    await root.render(
      App({
        items: ['foo', 'bar', 'baz'],
        current: 'foo',
      }),
    ).finished;

    expect(ref.current?.innerHTML).toBe('foo');

    await root.render(
      App({
        items: ['foo', 'bar', 'baz'],
        current: 'baz',
      }),
    ).finished;

    expect(ref.current?.innerHTML).toBe('baz');

    await root.render(
      App({
        items: ['foo', 'bar', 'baz'],
        current: 'bar',
      }),
    ).finished;

    expect(ref.current?.innerHTML).toBe('bar');
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
