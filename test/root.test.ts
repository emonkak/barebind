import { describe, expect, it, vi } from 'vitest';

import { createRoot } from '../src/root.js';
import { SyncUpdater } from '../src/updaters/syncUpdater.js';
import { MockRenderHost, TextDirective } from './mocks.js';

describe('createRoot()', () => {
  it('should mount a value inside the container', async () => {
    const container = document.createElement('div');
    const host = new MockRenderHost();
    const updater = new SyncUpdater();

    const value1 = new TextDirective('foo');
    const value2 = new TextDirective('bar');

    const flushUpdateSpy = vi.spyOn(updater, 'flushUpdate');

    const root = createRoot(value1, container, host, updater);
    root.mount();
    await updater.waitForUpdate();

    expect(container.innerHTML).toBe('foo<!--TextDirective-->');
    expect(flushUpdateSpy).toHaveBeenCalled();

    root.update(value2);
    await updater.waitForUpdate();

    expect(container.innerHTML).toBe('bar<!--TextDirective-->');
    expect(flushUpdateSpy).toHaveBeenCalledTimes(2);

    root.unmount();
    await updater.waitForUpdate();

    expect(container.innerHTML).toBe('');
    expect(flushUpdateSpy).toHaveBeenCalledTimes(3);
  });
});
