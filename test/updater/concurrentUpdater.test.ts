import { describe, expect, it, vi } from 'vitest';

import { ConcurrentUpdater } from '../../src/updater/concurrentUpdater.js';
import { MockBlock, MockRenderingEngine, MockScheduler } from '../mocks.js';

const CONTINUOUS_EVENT_TYPES: (keyof DocumentEventMap)[] = [
  'drag',
  'dragenter',
  'dragleave',
  'dragover',
  'mouseenter',
  'mouseleave',
  'mousemove',
  'mouseout',
  'mouseover',
  'pointerenter',
  'pointerleave',
  'pointermove',
  'pointerout',
  'pointerover',
  'scroll',
  'touchmove',
  'wheel',
];

const TASK_PRIORITIES: TaskPriority[] = [
  'user-blocking',
  'user-visible',
  'background',
];

describe('ConcurrentUpdater', () => {
  describe('.getCurrentPriority()', () => {
    it('should return "user-visible" if there is no current event', () => {
      const engine = new MockRenderingEngine();
      const updater = new ConcurrentUpdater(engine);

      vi.spyOn(globalThis, 'event', 'get').mockReturnValue(undefined);

      expect(updater.getCurrentPriority()).toBe('user-visible');
    });

    it('should return "user-blocking" if the current event is not continuous', () => {
      const engine = new MockRenderingEngine();
      const updater = new ConcurrentUpdater(engine);

      const eventMock = vi
        .spyOn(globalThis, 'event', 'get')
        .mockReturnValue(new MouseEvent('click'));

      expect(updater.getCurrentPriority()).toBe('user-blocking');
      expect(eventMock).toHaveBeenCalled();
    });

    it.each(CONTINUOUS_EVENT_TYPES)(
      'should return "user-visible" if the current event is continuous',
      (eventType) => {
        const engine = new MockRenderingEngine();
        const updater = new ConcurrentUpdater(engine);

        const eventMock = vi
          .spyOn(globalThis, 'event', 'get')
          .mockReturnValue(new CustomEvent(eventType));

        expect(updater.getCurrentPriority()).toBe('user-visible');
        expect(eventMock).toHaveBeenCalled();
      },
    );
  });

  describe('.isPending()', () => {
    it('should return true if there is a pending block', () => {
      const engine = new MockRenderingEngine();
      const updater = new ConcurrentUpdater(engine);

      updater.enqueueBlock(new MockBlock());

      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a block scheduled in rendering pipelines', () => {
      const engine = new MockRenderingEngine();
      const updater = new ConcurrentUpdater(engine);

      updater.enqueueBlock(new MockBlock());
      updater.scheduleUpdate();

      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending mutation effect', () => {
      const engine = new MockRenderingEngine();
      const updater = new ConcurrentUpdater(engine);

      updater.enqueueMutationEffect({ commit() {} });

      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending layout effect', () => {
      const engine = new MockRenderingEngine();
      const updater = new ConcurrentUpdater(engine);

      updater.enqueueLayoutEffect({ commit() {} });

      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending passive effect', () => {
      const engine = new MockRenderingEngine();
      const updater = new ConcurrentUpdater(engine);

      updater.enqueuePassiveEffect({ commit() {} });

      expect(updater.isPending()).toBe(true);
    });

    it('should return false if there are no pending tasks', () => {
      const engine = new MockRenderingEngine();
      const updater = new ConcurrentUpdater(engine);

      expect(updater.isPending()).toBe(false);
    });
  });

  describe('.isScheduled()', () => {
    it('should return whether an update is scheduled', async () => {
      const engine = new MockRenderingEngine();
      const updater = new ConcurrentUpdater(engine);

      updater.enqueueBlock(new MockBlock());
      expect(updater.isScheduled()).toBe(false);

      updater.scheduleUpdate();
      expect(updater.isScheduled()).toBe(true);

      await updater.waitForUpdate();
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.scheduleUpdate()', () => {
    it.each(TASK_PRIORITIES)(
      'should update the block according to its priority',
      async (priority) => {
        const engine = new MockRenderingEngine();
        const scheduler = new MockScheduler();
        const updater = new ConcurrentUpdater(engine, { scheduler });

        const block = new MockBlock();
        const prioritySpy = vi
          .spyOn(block, 'priority', 'get')
          .mockReturnValue(priority);
        const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');
        const updateSpy = vi
          .spyOn(block, 'update')
          .mockImplementation((_context, updater) => {
            expect(updater.getCurrentBlock()).toBe(block);
          });

        updater.enqueueBlock(block);
        updater.scheduleUpdate();

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
      const engine = new MockRenderingEngine();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater(engine, { scheduler });

      const block = new MockBlock();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };

      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');
      const updateSpy = vi
        .spyOn(block, 'update')
        .mockImplementation((_context, updater) => {
          expect(updater.getCurrentBlock()).toBe(block);
          updater.enqueueMutationEffect(mutationEffect);
          updater.enqueueLayoutEffect(layoutEffect);
          updater.enqueuePassiveEffect(passiveEffect);
          updater.scheduleUpdate();
        });

      updater.enqueueBlock(block);
      updater.scheduleUpdate();

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
      expect(updateSpy).toHaveBeenCalledOnce();
    });

    it('should commit mutation and layout effects with "user-blocking" priority', async () => {
      const engine = new MockRenderingEngine();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater(engine, { scheduler });

      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');

      updater.enqueueMutationEffect(mutationEffect);
      updater.enqueueLayoutEffect(layoutEffect);
      updater.scheduleUpdate();

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledWith(expect.any(Function), {
        priority: 'user-blocking',
      });
    });

    it('should commit passive effects with "background" priority', async () => {
      const engine = new MockRenderingEngine();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater(engine, { scheduler });

      const passiveEffect = { commit: vi.fn() };
      const requestCallbackSpy = vi.spyOn(scheduler, 'requestCallback');

      updater.enqueuePassiveEffect(passiveEffect);
      updater.scheduleUpdate();

      await updater.waitForUpdate();

      expect(passiveEffect.commit).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledOnce();
      expect(requestCallbackSpy).toHaveBeenCalledWith(expect.any(Function), {
        priority: 'background',
      });
    });

    it('should not update the block on a microtask if shouldUpdate() returns false', async () => {
      const engine = new MockRenderingEngine();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater(engine, { scheduler });

      const block = new MockBlock();
      const updateSpy = vi.spyOn(block, 'update');
      const shouldUpdateSpy = vi
        .spyOn(block, 'shouldUpdate')
        .mockReturnValue(false);

      updater.enqueueBlock(block);
      updater.scheduleUpdate();

      await updater.waitForUpdate();

      expect(updateSpy).not.toHaveBeenCalled();
      expect(shouldUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should yield to the main thread during an update if shouldYieldToMain() returns true', async () => {
      const engine = new MockRenderingEngine();
      const scheduler = new MockScheduler();
      const updater = new ConcurrentUpdater(engine, { scheduler });

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
      updater.scheduleUpdate();

      await updater.waitForUpdate();

      expect(getCurrentTimeSpy).toHaveBeenCalled();
      expect(shouldYieldToMainSpy).toHaveBeenCalledTimes(2);
      expect(yieldToMainSpy).toHaveBeenCalledTimes(2);
      expect(update1Spy).toHaveBeenCalledOnce();
      expect(update2Spy).toHaveBeenCalledOnce();
    });
  });
});
