import {
  createComponent,
  DOMAdapter,
  DOMRoot,
  html,
  RenderError,
  Runtime,
  step,
  type UpdateOptions,
} from 'barebind';
import { type LoggerAPI, UpdateLogger } from 'barebind/addons/update-logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('UpdateLogger', () => {
  let logger: LoggerAPI;
  let container: Element;
  let runtime: Runtime;
  let root: DOMRoot;

  beforeEach(() => {
    logger = {
      groupCollapsed: vi.fn(),
      groupEnd: vi.fn(),
      log: vi.fn(),
    };
    container = document.createElement('div');
    runtime = new Runtime(new DOMAdapter());
    runtime.use(new UpdateLogger(logger));
    root = new DOMRoot(container, runtime);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it.each<[UpdateOptions, string, string]>([
    [{ flushSync: true }, 'user-blocking', 'synchronous'],
    [{ viewTransition: true }, 'user-blocking', 'view-transition'],
    [{}, 'background', 'animation-frame'],
  ])('logs an update with $1 priority and $2 mode', async (options, expectedPriority, expectedMode) => {
    await root.render(html`<div>hello</div>`, options).finished;

    expect(logger.groupCollapsed).toHaveBeenCalledOnce();
    expect(logger.groupCollapsed).toHaveBeenCalledWith(
      expect.stringContaining(
        `Update #0 %cCOMPLETED%c at %c${DOMRoot.name}%c for step 1 in %c`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(logger.log).toHaveBeenCalledTimes(3);
    expect(logger.log).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`Under %c${DOMRoot.name}`),
      expect.any(String),
    );
    expect(logger.log).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        `Rendered with %c${expectedPriority}%c priority after %c`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(logger.log).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(
        `Committed with %c${expectedMode}%c mode after %c`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('logs an update from the child component', async () => {
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      return html`<button @click=${() => setCount((c) => c + 1)}>${count}</button>`;
    });

    await root.render(App({})).finished;

    container.querySelector('button')!.click();
    await step(runtime);

    expect(logger.groupCollapsed).toHaveBeenCalledTimes(2);
    expect(logger.groupCollapsed).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        `Update #1 %cCOMPLETED%c at %c${App.name}%c for step 1 in %c`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(logger.log).toHaveBeenCalledTimes(6);
    expect(logger.log).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining(`Under %c${DOMRoot.name} > ${App.name}`),
      expect.any(String),
    );
    expect(logger.log).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining(
        `Rendered with %cuser-blocking%c priority after %c`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(logger.log).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining(
        `Committed with %canimation-frame%c mode after %c`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('batches updates that are committed at the same time', async () => {
    const App = createComponent(function App() {
      return [Child({}), Child({})];
    });
    const Child = createComponent(function Child() {
      const [count, setCount] = this.useState(0);
      return html`<button @click=${() => setCount((c) => c + 1)}>${count}</button>`;
    });

    await root.render(App({})).finished;

    container.querySelectorAll('button')!.forEach((button) => {
      button.click();
    });
    await step(runtime);

    expect(logger.groupCollapsed).toHaveBeenCalledTimes(3);
    expect(logger.groupCollapsed).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        `Update #1 %cCOMPLETED%c at %c${Child.name}%c for step 1 in %c`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(logger.groupCollapsed).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(
        `Update #2 %cCOMPLETED%c at %c${Child.name}%c for step 2 in %c`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('logs FAILED status and aborted message when render throws', async () => {
    const App = createComponent(function App() {
      throw new Error('fail');
    });

    await expect(root.render(App({})).finished).rejects.toThrow(RenderError);

    expect(logger.groupCollapsed).toHaveBeenCalledOnce();
    expect(logger.groupCollapsed).toHaveBeenCalledWith(
      expect.stringContaining(
        `Update #0 %cFAILED%c at %c${DOMRoot.name}%c for step 1 in %c`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(logger.log).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(`Under %c${DOMRoot.name}`),
      expect.any(String),
    );
  });
});
