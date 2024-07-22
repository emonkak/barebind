import { describe, expect, it, vi } from 'vitest';

import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUnitOfWork, MockUpdateContext } from '../mocks.js';

describe('SyncUpdater', () => {
  describe('.getCurrentPriority()', () => {
    it('should return "user-blocking"', () => {
      const updater = new SyncUpdater(new MockUpdateContext());

      expect(updater.getCurrentPriority()).toBe('user-blocking');
    });
  });

  describe('.isPending()', () => {
    it('should return true if there is a pending unit of work', () => {
      const updater = new SyncUpdater(new MockUpdateContext());

      updater.enqueueUnitOfWork(new MockUnitOfWork());
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending mutation effect', () => {
      const updater = new SyncUpdater(new MockUpdateContext());

      updater.enqueueMutationEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending layout effect', () => {
      const updater = new SyncUpdater(new MockUpdateContext());

      updater.enqueueLayoutEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending passive effect', () => {
      const updater = new SyncUpdater(new MockUpdateContext());

      updater.enqueuePassiveEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return false if there are no pending tasks', () => {
      const updater = new SyncUpdater(new MockUpdateContext());

      expect(updater.isPending()).toBe(false);
    });
  });

  describe('.isScheduled()', () => {
    it('should return whether an update is scheduled', async () => {
      const updater = new SyncUpdater(new MockUpdateContext());

      expect(updater.isScheduled()).toBe(false);

      updater.scheduleUpdate();
      expect(updater.isScheduled()).toBe(true);

      await updater.waitForUpdate();
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.scheduleUpdate()', () => {
    it('should do nothing if already scheduled', async () => {
      const updater = new SyncUpdater(new MockUpdateContext());
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.scheduleUpdate();
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();
    });

    it('should update the unit of work on a microtask', async () => {
      const updater = new SyncUpdater(new MockUpdateContext());

      const unitOfWork = new MockUnitOfWork();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };
      const performWorkSpy = vi
        .spyOn(unitOfWork, 'performWork')
        .mockImplementation((_context, updater) => {
          expect(updater.getCurrentUnitOfWork()).toBe(unitOfWork);
          updater.enqueueMutationEffect(mutationEffect);
          updater.enqueueLayoutEffect(layoutEffect);
          updater.enqueuePassiveEffect(passiveEffect);
        });
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueUnitOfWork(unitOfWork);
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
      expect(performWorkSpy).toHaveBeenCalledOnce();
    });

    it('should cancel the update of the unit of work if shouldPerformWork() returns false ', async () => {
      const updater = new SyncUpdater(new MockUpdateContext());

      const unitOfWork = new MockUnitOfWork();
      const performWorkSpy = vi.spyOn(unitOfWork, 'performWork');
      const shouldPerformWorkSpy = vi
        .spyOn(unitOfWork, 'shouldPerformWork')
        .mockReturnValue(false);
      const cancelWorkSpy = vi.spyOn(unitOfWork, 'cancelWork');
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueUnitOfWork(unitOfWork);
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(performWorkSpy).not.toHaveBeenCalled();
      expect(shouldPerformWorkSpy).toHaveBeenCalledOnce();
      expect(cancelWorkSpy).toHaveBeenCalledOnce();
    });

    it('should commit effects on a microtask', async () => {
      const updater = new SyncUpdater(new MockUpdateContext());

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

    it('should cancel the update when flushed', () => {
      const updater = new SyncUpdater(new MockUpdateContext());

      updater.scheduleUpdate();
      updater.flush();

      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.waitForUpdate()', () => {
    it('should returns a resolved Promise if not scheduled', () => {
      const updater = new SyncUpdater(new MockUpdateContext());

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
