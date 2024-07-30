import { describe, expect, it, vi } from 'vitest';

import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost } from '../mocks.js';

describe('SyncUpdater', () => {
  describe('.isPending()', () => {
    it('should return true if there is a pending block', () => {
      const updater = new SyncUpdater();

      updater.enqueueBlock(new MockBlock());
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending mutation effect', () => {
      const updater = new SyncUpdater();

      updater.enqueueMutationEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending layout effect', () => {
      const updater = new SyncUpdater();

      updater.enqueueLayoutEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending passive effect', () => {
      const updater = new SyncUpdater();

      updater.enqueuePassiveEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return false if there are no pending tasks', () => {
      const updater = new SyncUpdater();

      expect(updater.isPending()).toBe(false);
    });
  });

  describe('.isScheduled()', () => {
    it('should return whether an update is scheduled', async () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      expect(updater.isScheduled()).toBe(false);

      updater.scheduleUpdate(host);
      expect(updater.isScheduled()).toBe(true);

      await updater.waitForUpdate();
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.scheduleUpdate()', () => {
    it('should do nothing if already scheduled', async () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.scheduleUpdate(host);
      updater.scheduleUpdate(host);

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();
    });

    it('should update the block on a microtask', async () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };
      const updateSpy = vi
        .spyOn(block, 'update')
        .mockImplementation((_host, updater) => {
          updater.enqueueMutationEffect(mutationEffect);
          updater.enqueueLayoutEffect(layoutEffect);
          updater.enqueuePassiveEffect(passiveEffect);
        });
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueBlock(block);
      updater.scheduleUpdate(host);

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
      const block = new MockBlock();
      const updateSpy = vi.spyOn(block, 'update');
      const shouldUpdateSpy = vi
        .spyOn(block, 'shouldUpdate')
        .mockReturnValue(false);
      const cancelUpdateSpy = vi.spyOn(block, 'cancelUpdate');
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueBlock(block);
      updater.scheduleUpdate(host);

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(updateSpy).not.toHaveBeenCalled();
      expect(shouldUpdateSpy).toHaveBeenCalledOnce();
      expect(cancelUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should commit effects on a microtask', async () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueMutationEffect(mutationEffect);
      updater.enqueueLayoutEffect(layoutEffect);
      updater.enqueuePassiveEffect(passiveEffect);
      updater.scheduleUpdate(host);

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
    });

    it('should cancel the update when flushed', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      updater.scheduleUpdate(host);
      updater.flushUpdate(host);

      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.waitForUpdate()', () => {
    it('should returns a resolved Promise if not scheduled', () => {
      const updater = new SyncUpdater();

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
