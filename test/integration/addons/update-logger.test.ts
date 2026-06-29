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

  it('logs groupCollapsed, log, and groupEnd on successful render', async () => {
    await root.render(html`<div>hello</div>`).finished;

    expect(logger.groupCollapsed).toHaveBeenCalledOnce();
    expect(logger.groupEnd).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledTimes(2);
  });

  it('logs each render separately', async () => {
    await root.render(html`<div>first</div>`).finished;
    await root.render(html`<div>second</div>`).finished;

    expect(logger.groupCollapsed).toHaveBeenCalledTimes(2);
    expect(logger.groupEnd).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenCalledTimes(4);
  });

  it.each<[UpdateOptions, string, string]>([
    [{ flushSync: true }, 'synchronous', 'user-blocking'],
    [{ viewTransition: true }, 'view-transition', 'user-blocking'],
    [{}, 'animation-frame', 'background'],
  ])('logs updates with $1 mode and $2 priority', async (options, expectedMode, expectedPriority) => {
    await root.render(html`<div>hello</div>`, options).finished;

    expect(logger.groupCollapsed).toHaveBeenCalledOnce();
    expect(logger.groupCollapsed).toHaveBeenCalledWith(
      expect.stringContaining(
        `Update #0 COMPLETED with %c${expectedMode}%c mode and %c${expectedPriority}%c priority in`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('logs render and commit phases with timing', async () => {
    const App = createComponent(function App() {
      const [count, setCount] = this.useState(0);
      return html`<button @click=${() => setCount((c) => c + 1)}>${count}</button>`;
    });

    await root.render(App({})).finished;

    container.querySelector('button')!.click();
    await step(runtime);

    expect(logger.log).toHaveBeenCalledTimes(4);
    expect(logger.log).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(
        `%cRENDER PHASE:%c Rendered %c<${App.name}>%c after`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(logger.log).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining(
        `%cCOMMIT PHASE:%c Committed %c<${App.name}>%c after`,
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
        `Update #0 FAILED with %canimation-frame%c mode and %cbackground%c priority in`,
      ),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(logger.log).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(`%cRENDER PHASE:%c Failed %c<${DOMRoot.name}>`),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });
});
