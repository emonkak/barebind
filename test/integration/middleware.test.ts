import {
  type Commit,
  DOMAdapter,
  DOMRoot,
  html,
  Runtime,
  type Update,
} from 'barebind';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Middleware', () => {
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

  it('calls middleware handle on render', async () => {
    const handle = vi.fn(passthrough);
    runtime.use({ handle });

    await root.render(html`<div>hello</div>`).finished;

    expect(handle).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe('<div>hello</div>');
  });

  it('calls multiple middlewares in registration order', async () => {
    const order: number[] = [];
    const middleware1 = {
      handle(update: Update, render: (update: Update) => Commit): Commit {
        order.push(1);
        return render(update);
      },
    };
    const middleware2 = {
      handle(update: Update, render: (update: Update) => Commit): Commit {
        order.push(2);
        return render(update);
      },
    };

    runtime.use(middleware1);
    runtime.use(middleware2);

    await root.render(html`<div>hello</div>`).finished;

    expect(order).toEqual([1, 2]);
  });

  it('calls middleware on each render', async () => {
    const handle = vi.fn(passthrough);
    runtime.use({ handle });

    await root.render(html`<div>first</div>`).finished;
    expect(handle).toHaveBeenCalledTimes(1);

    await root.render(html`<div>second</div>`).finished;
    expect(handle).toHaveBeenCalledTimes(2);
  });
});

function passthrough(
  update: Update,
  render: (update: Update) => Commit,
): Commit {
  return render(update);
}
