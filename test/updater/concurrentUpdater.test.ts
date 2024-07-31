import { describe, expect, it, vi } from 'vitest';

import { ConcurrentUpdater } from '../../src/updater/concurrentUpdater.js';
import { MockBlock, MockScheduler, MockUpdateHost } from '../mocks.js';

const TASK_PRIORITIES: TaskPriority[] = [
  'user-blocking',
  'user-visible',
  'background',
];

describe('ConcurrentUpdater', () => {
  describe('.isPending()', () => {
    it('should return true if there is a pending block', () => {
      const updater = new ConcurrentUpdater();

      updater.enqueueBlock(new MockBlock());

      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending mutation effect', () => {
      const updater = new ConcurrentUpdater();

      updater.enqueueMutationEffect({ commit() {} });

      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending layout effect', () => {
      const updater = new ConcurrentUpdater();

      updater.enqueueLayoutEffect({ commit() {} });

      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending passive effect', () => {
      const updater = new ConcurrentUpdater();

      updater.enqueuePassiveEffect({ commit() {} });

      expect(updater.isPending()).toBe(true);
    });

    it('should return false if there are no pending tasks', () => {
      const updater = new ConcurrentUpdater();

      expect(updater.isPending()).toBe(false);
    });
  });

  describe('.isScheduled()', () => {
    it('should return whether an update is scheduled', async () => {
      const host = new MockUpdateHost();
      const updater = new ConcurrentUpdater();

      updater.enqueueBlock(new MockBlock());
      expect(updater.isScheduled()).toBe(false);

      updater.scheduleUpdate(host);
      expect(updater.isScheduled()).toBe(true);

      await updater.waitForUpdate();
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.scheduleUpdate()', () => {
    it.each(TASK_PRIORITIES)(
      'should request update the block with its own priority',
      async (priority) => {
        const host = new MockUpdateHost();
        const scheduler = new MockScheduler();
        const updater = new ConcurrentUpdater({
          scheduler,
        });
        const block = new MockBlock();

        const prioritySpy = vi
          .spyOn(block, 'priority', 'get')
          .mockReturnValue(priority);
        const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');
        const updateSpy = vi.spyOn(block, 'update');

        updater.enqueueBlock(block);
        updater.scheduleUpdate(host);

        await updater.waitForUpdate();

        expect(prioritySpy).toHaveBeenCalledOnce();
        expect(requestCallbackSpy).toHaveBeenCalledOnce();
        expect(requestCallbackSpy).toHaveBeenCalledWith(expect.any(Function), {
          priority,
        });
        expect(updateSpy).toHaveBeenCalledOnce();
      },
    );

    it('should commit effects enqueued during an update', async () => {
      const host = new MockUpdateHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const block = new MockBlock();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };

      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');
      const updateSpy = vi
        .spyOn(block, 'update')
        .mockImplementation((_host, updater) => {
          updater.enqueueMutationEffect(mutationEffect);
          updater.enqueueLayoutEffect(layoutEffect);
          updater.enqueuePassiveEffect(passiveEffect);
          updater.scheduleUpdate(host);
        });

      updater.enqueueBlock(block);
      updater.scheduleUpdate(host);

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
      expect(updateSpy).toHaveBeenCalledOnce();
    });

    it('should commit mutation and layout effects with "user-blocking" priority', async () => {
      const host = new MockUpdateHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');

      updater.enqueueMutationEffect(mutationEffect);
      updater.enqueueLayoutEffect(layoutEffect);
      updater.scheduleUpdate(host);

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledWith(expect.any(Function), {
        priority: 'user-blocking',
      });
    });

    it('should commit passive effects with "background" priority', async () => {
      const host = new MockUpdateHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const passiveEffect = { commit: vi.fn() };
      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');

      updater.enqueuePassiveEffect(passiveEffect);
      updater.scheduleUpdate(host);

      await updater.waitForUpdate();

      expect(passiveEffect.commit).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledWith(expect.any(Function), {
        priority: 'background',
      });
    });

    it('should cancel the update of the block if shouldUpdate() returns false', async () => {
      const host = new MockUpdateHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const block = new MockBlock();
      const updateSpy = vi.spyOn(block, 'update');
      const shouldUpdateSpy = vi
        .spyOn(block, 'shouldUpdate')
        .mockReturnValue(false);
      const cancelUpdateSpy = vi.spyOn(block, 'cancelUpdate');

      updater.enqueueBlock(block);
      updater.scheduleUpdate(host);

      await updater.waitForUpdate();

      expect(updateSpy).not.toHaveBeenCalled();
      expect(shouldUpdateSpy).toHaveBeenCalledOnce();
      expect(cancelUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should yield to the main thread during an update if shouldYieldToMain() returns true', async () => {
      const host = new MockUpdateHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      let ticks = 0;

      const getCurrentTimeSpy = vi
        .spyOn(scheduler, 'getCurrentTime')
        .mockImplementation(() => ticks++);
      const shouldYieldToMainSpy = vi
        .spyOn(scheduler, 'shouldYieldToMain')
        .mockImplementation((elapsedTime: number) => {
          expect(elapsedTime).toBe(1);
          return true;
        });
      const yieldToMainSpy = vi.spyOn(scheduler, 'yieldToMain');

      const block1 = new MockBlock();
      const block2 = new MockBlock();
      const update1Spy = vi.spyOn(block1, 'update');
      const update2Spy = vi.spyOn(block1, 'update');

      updater.enqueueBlock(block1);
      updater.enqueueBlock(block2);
      updater.scheduleUpdate(host);

      await updater.waitForUpdate();

      expect(getCurrentTimeSpy).toHaveBeenCalled();
      expect(shouldYieldToMainSpy).toHaveBeenCalledTimes(2);
      expect(yieldToMainSpy).toHaveBeenCalledTimes(2);
      expect(update1Spy).toHaveBeenCalledOnce();
      expect(update2Spy).toHaveBeenCalledOnce();
    });
  });
});
