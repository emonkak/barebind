import { describe, expect, it, vi } from 'vitest';

import {
  CommitPhase,
  UpdateFlag,
  createUpdateQueue,
} from '../../src/baseTypes.js';
import { ConcurrentUpdater } from '../../src/updaters/concurrentUpdater.js';
import { MockBlock, MockRenderHost, MockScheduler } from '../mocks.js';

const TASK_PRIORITIES: TaskPriority[] = [
  'user-blocking',
  'user-visible',
  'background',
];

describe('ConcurrentUpdater', () => {
  describe('.waitForUpdate()', () => {
    it('should return a promise that will be fulfilled when the update is complete', async () => {
      const host = new MockRenderHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const queue = createUpdateQueue();

      queue.blocks.push(new MockBlock());

      expect(updater.isScheduled()).toBe(false);

      updater.scheduleUpdate(queue, host);
      expect(updater.isScheduled()).toBe(true);

      await updater.waitForUpdate();
      expect(updater.isScheduled()).toBe(false);
    });

    it('should return a fulfilled promise when the update is not scheduled', async () => {
      const updater = new ConcurrentUpdater();

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
    it.each(TASK_PRIORITIES)(
      'should request update the block with its own priority',
      async (priority) => {
        const host = new MockRenderHost();
        const scheduler = new MockScheduler();
        const updater = new ConcurrentUpdater({
          scheduler,
        });

        const queue = createUpdateQueue();
        const block = new MockBlock();

        queue.blocks.push(block);

        const getPrioritySpy = vi
          .spyOn(block, 'priority', 'get')
          .mockReturnValue(priority);
        const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');
        const updateSpy = vi.spyOn(block, 'update');

        updater.scheduleUpdate(queue, host);

        expect(getPrioritySpy).toHaveBeenCalledOnce();
        expect(requestCallbackSpy).toHaveBeenCalledOnce();
        expect(requestCallbackSpy).toHaveBeenCalledWith(expect.any(Function), {
          priority,
        });
        expect(updateSpy).not.toHaveBeenCalled();

        await updater.waitForUpdate();

        expect(updateSpy).toHaveBeenCalledOnce();
      },
    );

    it('should commit effects that enqueued during an update', async () => {
      const host = new MockRenderHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const queue = createUpdateQueue();
      const block = new MockBlock();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };

      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');
      const updateSpy = vi
        .spyOn(block, 'update')
        .mockImplementation((context) => {
          context.enqueueMutationEffect(mutationEffect);
          context.enqueueLayoutEffect(layoutEffect);
          context.enqueuePassiveEffect(passiveEffect);
          context.scheduleUpdate();
        });

      queue.blocks.push(block);
      updater.scheduleUpdate(queue, host);

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(mutationEffect.commit).toHaveBeenCalledWith(CommitPhase.Mutation);
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledWith(CommitPhase.Layout);
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledWith(CommitPhase.Passive);
      expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
      expect(updateSpy).toHaveBeenCalledOnce();
    });

    it('should commit UI effects with "user-blocking" priority', async () => {
      const host = new MockRenderHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const queue = createUpdateQueue();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };

      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');

      queue.mutationEffects.push(mutationEffect);
      queue.layoutEffects.push(layoutEffect);
      updater.scheduleUpdate(queue, host);

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledWith(expect.any(Function), {
        priority: 'user-blocking',
      });
    });

    it('should commit UI effects in view transition', async () => {
      const host = new MockRenderHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const queue = createUpdateQueue(UpdateFlag.ViewTransition);
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };

      const startViewTransitionSpy = vi.spyOn(host, 'startViewTransition');
      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');

      queue.mutationEffects.push(mutationEffect);
      queue.layoutEffects.push(layoutEffect);
      updater.scheduleUpdate(queue, host);

      await updater.waitForUpdate();

      expect(queue.flags).toBe(UpdateFlag.None);
      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(startViewTransitionSpy).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).not.toHaveBeenCalled();
    });

    it('should commit passive effects with "background" priority', async () => {
      const host = new MockRenderHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const queue = createUpdateQueue();
      const passiveEffect = { commit: vi.fn() };

      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');

      queue.passiveEffects.push(passiveEffect);
      updater.scheduleUpdate(queue, host);

      await updater.waitForUpdate();

      expect(passiveEffect.commit).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledWith(expect.any(Function), {
        priority: 'background',
      });
    });

    it('should cancel the update of the block if shouldUpdate() returns false', async () => {
      const host = new MockRenderHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const queue = createUpdateQueue();
      const block = new MockBlock();

      const updateSpy = vi.spyOn(block, 'update');
      const shouldUpdateSpy = vi
        .spyOn(block, 'shouldUpdate')
        .mockReturnValue(false);
      const cancelUpdateSpy = vi.spyOn(block, 'cancelUpdate');

      queue.blocks.push(block);
      updater.scheduleUpdate(queue, host);

      await updater.waitForUpdate();

      expect(updateSpy).not.toHaveBeenCalled();
      expect(shouldUpdateSpy).toHaveBeenCalledOnce();
      expect(cancelUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should prevent an update when an update is in progress', async () => {
      const host = new MockRenderHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const queue = createUpdateQueue();
      const block = new MockBlock();

      const updateSpy = vi
        .spyOn(block, 'update')
        .mockImplementation((context) => {
          context.scheduleUpdate();
        });

      queue.blocks.push(block);
      updater.scheduleUpdate(queue, host);

      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');

      await updater.waitForUpdate();

      expect(updateSpy).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).not.toHaveBeenCalled();
    });

    it('should yield to the main thread during an update if shouldYieldToMain() returns true', async () => {
      const host = new MockRenderHost();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater({
        scheduler,
      });

      const queue = createUpdateQueue();
      const block1 = new MockBlock();
      const block2 = new MockBlock();
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
      const update1Spy = vi.spyOn(block1, 'update');
      const update2Spy = vi.spyOn(block1, 'update');

      queue.blocks.push(block1);
      queue.blocks.push(block2);
      updater.scheduleUpdate(queue, host);

      await updater.waitForUpdate();

      expect(getCurrentTimeSpy).toHaveBeenCalled();
      expect(shouldYieldToMainSpy).toHaveBeenCalledTimes(2);
      expect(yieldToMainSpy).toHaveBeenCalledTimes(2);
      expect(update1Spy).toHaveBeenCalledOnce();
      expect(update2Spy).toHaveBeenCalledOnce();
    });
  });
});
