import { describe, expect, it, vi } from 'vitest';

import { mount } from '../src/mount.js';
import { directiveTag } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockBinding, MockDirective, MockUpdateContext } from './mocks.js';

describe('mount()', () => {
  it('should mount element inside the container', async () => {
    const directive = new MockDirective();
    const container = document.createElement('div');
    const updater = new SyncUpdater(new MockUpdateContext());
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const isScheduledSpy = vi.spyOn(updater, 'isScheduled');
    const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

    expect(mount(directive, container, updater)).toBeInstanceOf(MockBinding);
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(isScheduledSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).toHaveBeenCalled();

    await updater.waitForUpdate();

    expect(container.innerHTML).toBe('<!---->');
  });

  it('should not schedule update if it is already scheduled', () => {
    const directive = new MockDirective();
    const container = document.createElement('div');
    const updater = new SyncUpdater(new MockUpdateContext());
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const isScheduledSpy = vi
      .spyOn(updater, 'isScheduled')
      .mockReturnValue(true);
    const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

    expect(mount(directive, container, updater)).toBeInstanceOf(MockBinding);
    expect(container.innerHTML).toBe('');
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(isScheduledSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).not.toHaveBeenCalled();
  });
});
