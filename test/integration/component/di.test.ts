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
