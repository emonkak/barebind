import { describe, expect, it, vi } from 'vitest';

import { createUpdatePipeline } from '../../src/baseTypes.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost } from '../mocks.js';

describe('SyncUpdater', () => {
  describe('.waitForUpdate()', () => {
    it('should return a promise that will be fulfilled when the update is complete', async () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const pipeline = createUpdatePipeline();

      expect(updater.isScheduled()).toBe(false);

      updater.scheduleUpdate(pipeline, host);
      expect(updater.isScheduled()).toBe(true);

      await updater.waitForUpdate();
      expect(updater.isScheduled()).toBe(false);
    });

    it('should return a fulfilled promise when the update is not scheduled', async () => {
      const updater = new SyncUpdater();

      const isFulfilled = await Promise.race([
        updater.waitForUpdate().then(
          () => true,
          () => false,
        ),
        Promise.resolve().then(
          () => false,
          () => false,
        ),
      ]);

      expect(isFulfilled).toBe(true);
    });
  });

  describe('.scheduleUpdate()', () => {
    it('should do nothing if already scheduled', async () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const pipeline = createUpdatePipeline();

      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.scheduleUpdate(pipeline, host);
      updater.scheduleUpdate(pipeline, host);

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();
    });

    it('should update the block on a microtask', async () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const pipeline = createUpdatePipeline();
      const block = new MockBlock();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };

      const updateSpy = vi
        .spyOn(block, 'update')
        .mockImplementation((context) => {
          context.enqueueMutationEffect(mutationEffect);
          context.enqueueLayoutEffect(layoutEffect);
          context.enqueuePassiveEffect(passiveEffect);
        });
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      pipeline.blocks.push(block);
      updater.scheduleUpdate(pipeline, host);

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
      expect(updateSpy).toHaveBeenCalledOnce();
    });

    it('should cancel the update of the block if shouldUpdate() returns false ', async () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const pipeline = createUpdatePipeline();
      const block = new MockBlock();

      const updateSpy = vi.spyOn(block, 'update');
      const shouldUpdateSpy = vi
        .spyOn(block, 'shouldUpdate')
        .mockReturnValue(false);
      const cancelUpdateSpy = vi.spyOn(block, 'cancelUpdate');
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      pipeline.blocks.push(block);
      updater.scheduleUpdate(pipeline, host);

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(updateSpy).not.toHaveBeenCalled();
      expect(shouldUpdateSpy).toHaveBeenCalledOnce();
      expect(cancelUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should block an update while the update pipeline is running', async () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const pipeline = createUpdatePipeline();
      const block = new MockBlock();

      const updateSpy = vi
        .spyOn(block, 'update')
        .mockImplementation((context) => {
          context.scheduleUpdate();
        });
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      pipeline.blocks.push(block);
      updater.scheduleUpdate(pipeline, host);

      await updater.waitForUpdate();

      expect(updateSpy).toHaveBeenCalledOnce();
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should commit effects on a microtask', async () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const pipeline = createUpdatePipeline();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };

      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      pipeline.mutationEffects.push(mutationEffect);
      pipeline.layoutEffects.push(layoutEffect);
      pipeline.passiveEffects.push(passiveEffect);
      updater.scheduleUpdate(pipeline, host);

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
    });
  });
});
