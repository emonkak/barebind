import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  RenderError,
  Runtime,
  step,
  type VElement,
} from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Dependency injection', () => {
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

  class Context {
    value: unknown;
    constructor(value: unknown) {
      this.value = value;
    }
  }

  class ContextWithDefault {
    static getDefault(): ContextWithDefault {
      return new ContextWithDefault('default');
    }
    value: unknown;
    constructor(value: unknown) {
      this.value = value;
    }
  }

  it('injects the instance provided by itself', async () => {
    const App = createComponent(function App() {
      this.provide(new Context('hello'));
      const context = this.inject(Context);
      return html`<div>${context.value}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>hello</div>');
  });

  it('injects the instance provided by the parent', async () => {
    const Child = createComponent(function Child() {
      const context = this.inject(Context);
      return html`<div>${context.value}</div>`;
    });
    const App = createComponent(function App() {
      this.provide(new Context('hello'));
      return Child({});
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>hello</div>');
  });

  it('injects the instance provided by the nearest parent', async () => {
    const GrandChild = createComponent(function GrandChild() {
      const context = this.inject(Context);
      return html`<div>${context.value}</div>`;
    });
    const Child = createComponent(function Child() {
      this.provide(new Context('child'));
      return GrandChild({});
    });
    const App = createComponent(function App() {
      this.provide(new Context('parent'));
      return Child({});
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>child</div>');
  });

  it('injects multiple instances', async () => {
    const Child = createComponent(function Child() {
      const context1 = this.inject(Context);
      const context2 = this.inject(ContextWithDefault);
      return html`<div>${context1.value} ${context2.value}</div>`;
    });
    const App = createComponent(function App() {
      this.provide(new Context('foo'));
      this.provide(new ContextWithDefault('bar'));
      return Child({});
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>foo bar</div>');
  });

  it('injects the last provided instance', async () => {
    const App = createComponent(function App() {
      this.provide(new Context('first'));
      this.provide(new Context('second'));
      const context = this.inject(Context);
      return html`<div>${context.value}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>second</div>');
  });

  it('injects the default instance from getDefault()', async () => {
    const App = createComponent(function App() {
      const context = this.inject(ContextWithDefault);
      return html`<div>${context.value}</div>`;
    });

    await root.render(App({})).finished;
    expect(container.innerHTML).toBe('<div>default</div>');
  });

  it('injects the instance after rendering', async () => {
    let context: Context | undefined;
    const App = createComponent(function App() {
      this.provide(new Context('a'));
      this.useEffect(() => {
        context = this.inject(Context);
      });
      return null;
    });

    await root.render(App({})).finished;
    expect(context?.value).toBe('a');
  });

  it('inherits the latest instance in child updates', async () => {
    const Child = createComponent(function Child() {
      const context = this.inject(Context);
      return html`
        <button
          @click=${() => {
            this.forceUpdate();
          }}
        >
          ${context.value}
        </button>
      `;
    });
    const App = createComponent(function App({ value }: { value: unknown }) {
      this.provide(new Context(value));
      return Child({});
    });

    await root.render(App({ value: 'first' })).finished;
    const button = container.querySelector('button')!;
    expect(container.innerHTML).toBe('<button>first</button>');

    await root.render(App({ value: 'second' })).finished;
    expect(container.innerHTML).toBe('<button>second</button>');

    button.click();
    await step(runtime);
    expect(container.innerHTML).toBe('<button>second</button>');
  });

  it('injects from the committed scope after a failed render', async () => {
    const Child = createComponent(function Child() {
      const context = this.inject(Context);
      if (context.value != null) {
        throw context.value;
      }
      return html`
        <button
          @click=${() => {
            this.forceUpdate();
          }}
        ></button>
      `;
    });
    const App = createComponent(function App({ error }: { error?: unknown }) {
      this.provide(new Context(error));
      return Child({});
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;

    await expect(
      root.render(App({ error: new Error('fail') })).finished,
    ).rejects.toThrow(RenderError);

    button.click();
    await step(runtime);
  });

  it('updates children when the provided context value changes', async () => {
    const Select = createComponent(function Select({
      children,
      initialValue,
    }: {
      children: VElement[];
      initialValue: unknown;
    }) {
      const [value, setValue] = this.useState<unknown>(initialValue);
      const handleChange = (event: Event) => {
        setValue((event.currentTarget as HTMLOptionElement).value);
      };
      this.provide(new Context(value));
      return html`
        <select @change=${handleChange}>
          <${children}>
        </select>
      `;
    });
    const Option = createComponent(function Option({
      value,
    }: {
      value: unknown;
    }) {
      const context = this.inject(Context);
      const selected = value === context.value;
      return html`
        <option selected=${selected} value=${value}>
          ${value}
        </option>
      `;
    });
    const App = createComponent(function App({
      items,
      initialItem,
    }: {
      items: string[];
      initialItem: string;
    }) {
      return Select({
        children: items.map((item) => Option({ value: item })),
        initialValue: initialItem,
      });
    });

    await root.render(App({ items: ['foo', 'bar'], initialItem: 'foo' }))
      .finished;
    expect(container.innerHTML).toBe(
      '<select><option selected="" value="foo">foo</option><option value="bar">bar</option><!----></select>',
    );

    const select = container.querySelector('select')!;
    select.value = 'bar';
    select.dispatchEvent(new Event('change'));
    await step(runtime);
    expect(container.innerHTML).toBe(
      '<select><option value="foo">foo</option><option value="bar" selected="">bar</option><!----></select>',
    );
  });

  it('throws when injectable is not found', async () => {
    const App = createComponent(function App() {
      this.inject(class {});
      return html`<div>unreachable</div>`;
    });

    await expect(root.render(App({})).finished).rejects.toThrow(RenderError);
  });

  it('throws when providing the instance after rendering', async () => {
    const App = createComponent(function App() {
      this.useEffect(() => {
        this.provide(new Context('a'));
      });
      return null;
    });

    await expect(root.render(App({})).finished).rejects.toThrow(TypeError);
  });
});
