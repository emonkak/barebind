import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import {
  UpdateProfiler,
  type UserTimingAPI,
} from 'barebind/addons/update-profiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('UpdateProfiler', () => {
  let userTiming: UserTimingAPI;
  let container: Element;
  let runtime: Runtime;
  let root: DOMRoot;

  beforeEach(() => {
    userTiming = {
      mark: vi.fn(),
      measure: vi.fn(),
    };
    container = document.createElement('div');
    runtime = new Runtime(new DOMAdapter());
    runtime.use(new UpdateProfiler(userTiming));
    root = new DOMRoot(container, runtime);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('marks phase start and end on successful render', async () => {
    await root.render(html`<div>hello</div>`).finished;

    expect(userTiming.mark).toHaveBeenCalledTimes(4);
    expect(userTiming.mark).toHaveBeenNthCalledWith(
      1,
      'barebind:render-start:0',
    );
    expect(userTiming.mark).toHaveBeenNthCalledWith(2, 'barebind:render-end:0');
    expect(userTiming.mark).toHaveBeenNthCalledWith(
      3,
      'barebind:commit-start:0',
    );
    expect(userTiming.mark).toHaveBeenNthCalledWith(4, 'barebind:commit-end:0');
  });

  it('creates separate marks and measures for each render', async () => {
    await root.render(html`<div>first</div>`).finished;
    await root.render(html`<div>second</div>`).finished;

    expect(userTiming.mark).toHaveBeenCalledTimes(8);
    expect(userTiming.measure).toHaveBeenCalledTimes(6);
  });

  it('creates measures for each update', async () => {
    await root.render(html`<div>hello</div>`).finished;

    expect(userTiming.measure).toHaveBeenCalledTimes(3);
    expect(userTiming.measure).toHaveBeenNthCalledWith(
      1,
      `Update ${DOMRoot.name}`,
      'barebind:render-start:0',
      'barebind:commit-end:0',
    );
    expect(userTiming.measure).toHaveBeenNthCalledWith(
      2,
      `Render ${DOMRoot.name}`,
      'barebind:render-start:0',
      'barebind:render-end:0',
    );
    expect(userTiming.measure).toHaveBeenNthCalledWith(
      3,
      `Commit ${DOMRoot.name}`,
      'barebind:commit-start:0',
      'barebind:commit-end:0',
    );
  });
});
