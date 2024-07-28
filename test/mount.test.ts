import { describe, expect, it, vi } from 'vitest';

import { mount } from '../src/mount.js';
import { directiveTag } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockRenderHost, TextBinding, TextDirective } from './mocks.js';

describe('mount()', () => {
  it('should mount element inside the container', async () => {
    const directive = new TextDirective();
    const container = document.createElement('div');
    const updater = new SyncUpdater(new MockRenderHost());
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const isScheduledSpy = vi.spyOn(updater, 'isScheduled');
    const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

    expect(mount(directive, container, updater)).toBeInstanceOf(TextBinding);
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(isScheduledSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).toHaveBeenCalled();

    await updater.waitForUpdate();

    expect(container.innerHTML).toBe('<!--TextDirective-->');
  });

  it('should not schedule update if it is already scheduled', () => {
    const directive = new TextDirective();
    const container = document.createElement('div');
    const updater = new SyncUpdater(new MockRenderHost());
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const isScheduledSpy = vi
      .spyOn(updater, 'isScheduled')
      .mockReturnValue(true);
    const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

    expect(mount(directive, container, updater)).toBeInstanceOf(TextBinding);
    expect(container.innerHTML).toBe('');
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(isScheduledSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).not.toHaveBeenCalled();
  });
});
