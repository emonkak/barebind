import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  Runtime,
  step,
  type UpdateHandle,
} from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Transition', () => {
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

  it('starts transitions in unique lanes', async () => {
    const handles: UpdateHandle[] = [];
    const App = createComponent(function App() {
      const [transition, setTransition] = this.useState(-1);
      return html`
        <button
          @click=${() => {
            handles.push(
              this.startTransition((transition) =>
                setTransition(transition, { flushSync: true, transition }),
              ),
            );
          }}>${transition}</button>
      `;
    });

    await root.render(App({})).finished;
    const button = container.querySelector<HTMLButtonElement>('button')!;
    expect(button.textContent).toBe('-1');

    for (let i = 0; i < 24; i++) {
      button.click();
      await step(runtime);
      expect(button.textContent).toBe(i.toString());
    }

    expect(new Set(handles.map((handle) => handle.lanes)).size).toBe(24);
  });
});
