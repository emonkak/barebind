import { describe, expect, it, vi } from 'vitest';

import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockRenderingEngine } from '../mocks.js';

describe('SyncUpdater', () => {
  describe('.getCurrentPriority()', () => {
    it('should return "user-blocking"', () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      expect(updater.getCurrentPriority()).toBe('user-blocking');
    });
  });

  describe('.isPending()', () => {
    it('should return true if there is a pending block', () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      updater.enqueueBlock(new MockBlock());
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending mutation effect', () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      updater.enqueueMutationEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending layout effect', () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      updater.enqueueLayoutEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending passive effect', () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      updater.enqueuePassiveEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return false if there are no pending tasks', () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      expect(updater.isPending()).toBe(false);
    });
  });

  describe('.isScheduled()', () => {
    it('should return whether an update is scheduled', async () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      expect(updater.isScheduled()).toBe(false);

      updater.scheduleUpdate();
      expect(updater.isScheduled()).toBe(true);

      await updater.waitForUpdate();
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.scheduleUpdate()', () => {
    it('should do nothing if already scheduled', async () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.scheduleUpdate();
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();
    });

    it('should update the block on a microtask', async () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const block = new MockBlock();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };
      const updateSpy = vi
        .spyOn(block, 'update')
        .mockImplementation((_context, updater) => {
          expect(updater.getCurrentBlock()).toBe(block);
          updater.enqueueMutationEffect(mutationEffect);
          updater.enqueueLayoutEffect(layoutEffect);
          updater.enqueuePassiveEffect(passiveEffect);
        });
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueBlock(block);
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
      expect(updateSpy).toHaveBeenCalledOnce();
    });

    it('should not update the block on a microtask if shouldUpdate() returns false ', async () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const block = new MockBlock();
      const updateSpy = vi.spyOn(block, 'update');
      const shouldUpdateSpy = vi
        .spyOn(block, 'shouldUpdate')
        .mockReturnValue(false);
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueBlock(block);
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(updateSpy).not.toHaveBeenCalled();
      expect(shouldUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should commit effects on a microtask', async () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueMutationEffect(mutationEffect);
      updater.enqueueLayoutEffect(layoutEffect);
      updater.enqueuePassiveEffect(passiveEffect);
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
    });
  });

  describe('.waitForUpdate()', () => {
    it('should returns a resolved Promise if not scheduled', () => {
      const engine = new MockRenderingEngine();
      const updater = new SyncUpdater(engine);

      expect(
        Promise.race([
          updater.waitForUpdate().then(
            () => true,
            () => false,
          ),
          Promise.resolve().then(
            () => false,
            () => false,
          ),
        ]),
      ).resolves.toBe(true);
    });
  });
});
