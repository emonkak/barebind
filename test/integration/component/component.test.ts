import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  RenderError,
  Runtime,
  step,
} from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Component', () => {
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

  it('renders the props passed as an argument', async () => {
    const App = createComponent(function App({ message }: { message: string }) {
      return html`<div>${message}</div>`;
    });

    await root.render(App({ message: 'hello' })).finished;
    expect(container.innerHTML).toBe('<div>hello</div>');
  });

  it('re-renders when the props change', async () => {
    const App = createComponent(function App({ value }: { value: number }) {
      return html`<div>${value}</div>`;
    });

    await root.render(App({ value: 1 })).finished;
    expect(container.innerHTML).toBe('<div>1</div>');

    await root.render(App({ value: 2 })).finished;
    expect(container.innerHTML).toBe('<div>2</div>');
  });

  it('skips re-render when arePropsEqual() returns true', async () => {
    let renderCount = 0;
    const App = createComponent(
      function App() {
        renderCount++;
        return html`<div>hello</div>`;
      },
      { arePropsEqual: () => true },
    );

    await root.render(App({})).finished;
    expect(renderCount).toBe(1);

    await root.render(App({ value: 1 })).finished;
    expect(renderCount).toBe(1);
  });

  it('reuses component instances after reorder with internal state update', async () => {
    const Item = createComponent(
      function Item({ id }: { id: string }) {
        const [count, setCount] = this.useState(0);
        return html`
          <button
            id=${id}
            @click=${() => {
              setCount((count) => count + 1);
            }}
          >
            ${count}
          </button>
        `;
      },
      { arePropsEqual: () => true },
    );
    const render = (ids: string[]) =>
      html`<div><${ids.map((id) => Item({ id }).withKey(id))}></div>`;

    await root.render(render(['a', 'b'])).finished;
    expect(container.innerHTML).toBe(
      '<div><button id="a">0</button><button id="b">0</button><!----></div>',
    );

    await root.render(render(['b', 'a'])).finished;
    expect(container.innerHTML).toBe(
      '<div><button id="b">0</button><button id="a">0</button><!----></div>',
    );

    container.querySelector<HTMLElement>('#b')?.click();
    await step(runtime);
    expect(container.innerHTML).toBe(
      '<div><button id="b">1</button><button id="a">0</button><!----></div>',
    );

    await root.render(render(['b', 'a'])).finished;
    expect(container.innerHTML).toBe(
      '<div><button id="b">1</button><button id="a">0</button><!----></div>',
    );
  });

  it('applies state updates to the committed component after a failed render', async () => {
    const App = createComponent(function App({ error }: { error?: unknown }) {
      const [count, setCount] = this.useState(0);
      if (error != null) {
        throw error;
      }
      return html`
        <button
          @click=${() => {
            setCount(count + 1);
          }}>
          ${count}
        </button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('0');

    await expect(
      root.render(App({ error: new Error('fail') })).finished,
    ).rejects.toThrow(RenderError);

    button.click();
    await step(runtime);
    expect(button.textContent).toBe('1');
  });

  it('throws RenderError on render exception', async () => {
    const Child = createComponent(function Child() {
      throw new Error('fail');
    });
    const App = createComponent(function App() {
      return Child({});
    });

    let caughtError!: Error;
    try {
      await root.render(App({})).finished;
    } catch (error: any) {
      caughtError = error;
    }
    expect(caughtError).toBeInstanceOf(RenderError);
    expect(caughtError!.message).toBe(
      [
        'An error occurred during rendering.',
        DOMRoot.name,
        `\`- ${App.name}`,
        `   \`- ${Child.name} <- ERROR occurred here!`,
      ].join('\n'),
    );
    expect(caughtError!.cause).toBeInstanceOf(Error);
    expect((caughtError!.cause as Error).message).toBe('fail');
  });

  it('throws RenderError on mismatched hook types', async () => {
    const App = createComponent(function App({ first }: { first: boolean }) {
      if (first) {
        this.useId();
        this.useEffect(() => {});
      } else {
        this.useEffect(() => {});
        this.useId();
      }
      return html`<div>hello</div>`;
    });

    await root.render(App({ first: true })).finished;

    let caughtError!: Error;
    try {
      await root.render(App({ first: false })).finished;
    } catch (error: any) {
      caughtError = error;
    }
    expect(caughtError).toBeInstanceOf(RenderError);
    expect(caughtError!.message).toBe(
      [
        'An error occurred during rendering.',
        DOMRoot.name,
        `\`- ${App.name} <- ERROR occurred here!`,
      ].join('\n'),
    );
    expect(caughtError!.cause).toBeInstanceOf(Error);
    expect((caughtError!.cause as Error).message).toContain(
      'Unexpected hook type.',
    );
  });
});
