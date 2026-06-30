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
  ])('logs updates with $1 priority and $2 mode', async (options, expectedPriority, expectedMode) => {
    await root.render(html`<div>hello</div>`, options).finished;

    expect(logger.groupCollapsed).toHaveBeenCalledOnce();
    expect(logger.groupCollapsed).toHaveBeenCalledWith(
      expect.stringContaining(
        `Update #0 %cCOMPLETED%c from %c${DOMRoot.name}%c in %c`,
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
      expect.stringContaining(`Started from %c${DOMRoot.name}`),
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

  it('logs updates from child components', async () => {
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
        `Update #1 %cCOMPLETED%c from %c${App.name}%c in %c`,
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
      expect.stringContaining(`Started from %c${DOMRoot.name} > ${App.name}`),
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

  it('logs FAILED status and aborted message when render throws', async () => {
    const App = createComponent(function App() {
      throw new Error('fail');
    });

    await expect(root.render(App({})).finished).rejects.toThrow(RenderError);

    expect(logger.groupCollapsed).toHaveBeenCalledOnce();
    expect(logger.groupCollapsed).toHaveBeenCalledWith(
      expect.stringContaining(
        `Update #0 %cFAILED%c from %c${DOMRoot.name}%c in %c`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(logger.log).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(`Started from %c${DOMRoot.name}`),
      expect.any(String),
    );
  });
});
