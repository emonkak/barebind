import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDefaultScheduler } from '../src/scheduler.js';

describe('getCurrentTime()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('using performance.now()', () => {
    beforeEach(() => {
      vi.stubGlobal('performance', {
        now() {
          return Date.now();
        },
      } as Partial<Performance>);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return the current time', () => {
      const now = Date.now();
      const spy = vi.spyOn(performance, 'now').mockReturnValue(now);
      const scheduler = getDefaultScheduler();
      expect(scheduler.getCurrentTime()).toBe(now);
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('using Date.now()', () => {
    beforeEach(() => {
      vi.stubGlobal('performance', {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return the current time', () => {
      const now = Date.now();
      const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
      const scheduler = getDefaultScheduler();
      expect(scheduler.getCurrentTime()).toBe(now);
      expect(spy).toHaveBeenCalledOnce();
    });
  });
});

describe('requestCallback()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('using Scheduler.postTask()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {
        postTask(callback) {
          return callback();
        },
      } as Partial<Scheduler>);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should schedule the callback', () => {
      const callback = () => {};
      const options = { priority: 'user-blocking' } as const;
      const postTaskSpy = vi.spyOn(globalThis.scheduler, 'postTask');
      const scheduler = getDefaultScheduler();
      scheduler.requestCallback(callback, options);
      expect(postTaskSpy).toHaveBeenCalledOnce();
      expect(postTaskSpy).toHaveBeenCalledWith(callback, options);
    });
  });

  describe('using queueMicrotask', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should schedule the callback with "user-blocking" priority by queueMicrotask()', () => {
      const callback = () => {};
      const queueMicrotaskSpy = vi
        .spyOn(globalThis, 'queueMicrotask')
        .mockImplementation((callback) => {
          callback();
        });
      const scheduler = getDefaultScheduler();
      scheduler.requestCallback(callback, {
        priority: 'user-blocking',
      });
      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();
      expect(queueMicrotaskSpy).toHaveBeenCalledWith(callback);
    });
  });

  describe('using setTimeout()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {});
      vi.stubGlobal('requestIdleCallback', undefined);
    });

    it('should schedule the callback without priority', () => {
      const callback = () => {};
      const setTimeoutSpy = vi
        .spyOn(globalThis, 'setTimeout')
        .mockImplementation((callback) => {
          callback();
          return 0 as any;
        });
      const scheduler = getDefaultScheduler();
      scheduler.requestCallback(callback);
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(callback);
    });

    it('should schedule the callback with "user-visible" priority', () => {
      const callback = () => {};
      const setTimeoutSpy = vi
        .spyOn(globalThis, 'setTimeout')
        .mockImplementation((callback) => {
          callback();
          return 0 as any;
        });
      const scheduler = getDefaultScheduler();
      scheduler.requestCallback(callback, {
        priority: 'user-visible',
      });
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(callback);
    });

    it('should schedule the callback with "background" priority', () => {
      const callback = () => {};
      const setTimeoutSpy = vi
        .spyOn(globalThis, 'setTimeout')
        .mockImplementation((callback) => {
          callback();
          return 0 as any;
        });
      const scheduler = getDefaultScheduler();
      scheduler.requestCallback(callback, {
        priority: 'background',
      });
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(callback);
    });
  });

  describe('using requestIdleCallback()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {});
      vi.stubGlobal('requestIdleCallback', ((callback) => {
        callback({} as IdleDeadline);
        return 0;
      }) as typeof requestIdleCallback);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should schedule the callback with "background" priority', () => {
      const callback = () => {};
      const requestIdleCallbackSpy = vi.spyOn(
        globalThis,
        'requestIdleCallback',
      );
      const scheduler = getDefaultScheduler();
      scheduler.requestCallback(callback, { priority: 'background' });
      expect(requestIdleCallbackSpy).toHaveBeenCalledOnce();
      expect(requestIdleCallbackSpy).toHaveBeenCalledWith(callback);
    });
  });
});

describe('shouldYieldToMain()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('using isInputPending()', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', {
        scheduling: {
          isInputPending() {
            return false;
          },
        } as Partial<Scheduling>,
      } as Partial<Navigator>);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return false if the elapsed time is less than 5ms', () => {
      const scheduler = getDefaultScheduler();

      expect(scheduler.shouldYieldToMain(0)).toBe(false);
      expect(scheduler.shouldYieldToMain(4)).toBe(false);
    });

    it('should return the result of isInputPending() without continuous events if the elapsed time is between 5ms and 49ms', () => {
      const scheduler = getDefaultScheduler();
      const isInputPendingSpy = vi
        .spyOn(navigator.scheduling, 'isInputPending')
        .mockReturnValue(false);

      expect(scheduler.shouldYieldToMain(5)).toBe(false);
      expect(isInputPendingSpy).toHaveBeenCalledTimes(1);
      expect(isInputPendingSpy).toHaveBeenLastCalledWith({
        includeContinuous: false,
      });

      expect(scheduler.shouldYieldToMain(49)).toBe(false);
      expect(isInputPendingSpy).toHaveBeenCalledTimes(2);
      expect(isInputPendingSpy).toHaveBeenLastCalledWith({
        includeContinuous: false,
      });
    });

    it('should return the result of isInputPending() with continuous events if the elapsed time is between 50ms and 299ms', () => {
      const scheduler = getDefaultScheduler();
      const isInputPendingSpy = vi
        .spyOn(navigator.scheduling, 'isInputPending')
        .mockReturnValue(false);

      expect(scheduler.shouldYieldToMain(50)).toBe(false);
      expect(isInputPendingSpy).toHaveBeenCalledTimes(1);
      expect(isInputPendingSpy).toHaveBeenLastCalledWith({
        includeContinuous: true,
      });

      expect(scheduler.shouldYieldToMain(299)).toBe(false);
      expect(isInputPendingSpy).toHaveBeenCalledTimes(2);
      expect(isInputPendingSpy).toHaveBeenLastCalledWith({
        includeContinuous: true,
      });
    });

    it('should return true if the elapsed time is greater than or equal to 300ms', () => {
      const scheduler = getDefaultScheduler();
      expect(scheduler.shouldYieldToMain(300)).toBe(true);
    });
  });

  describe('not using isInputPending()', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', {
        scheduling: {},
      } as Partial<Navigator>);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return true if the elapsed time is greater than or equal to 5ms', () => {
      const scheduler = getDefaultScheduler();

      expect(scheduler.shouldYieldToMain(0)).toBe(false);
      expect(scheduler.shouldYieldToMain(4)).toBe(false);
      expect(scheduler.shouldYieldToMain(5)).toBe(true);
    });
  });
});

describe('yieldToMain()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('using scheduler.yield()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {
        yield() {
          return Promise.resolve();
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return the promise by scheduler.yield()', () => {
      const scheduler = getDefaultScheduler();
      const yieldSpy = vi.spyOn(globalThis.scheduler, 'yield');
      const options = { priority: 'inherit' } as const;
      expect(scheduler.yieldToMain(options)).resolves.toBeUndefined();
      expect(yieldSpy).toHaveBeenCalledOnce();
      expect(yieldSpy).toHaveBeenCalledWith(options);
    });
  });

  describe('using queueMicrotask()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should wait until the current callback has completed', () => {
      const scheduler = getDefaultScheduler();
      const queueMicrotaskSpy = vi
        .spyOn(globalThis, 'queueMicrotask')
        .mockImplementation((callback) => {
          callback();
        });
      expect(scheduler.yieldToMain()).resolves.toBeUndefined();
      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();
    });
  });
});
