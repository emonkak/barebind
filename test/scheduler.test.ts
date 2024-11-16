import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDefaultScheduler } from '../src/scheduler.js';

describe('getCurrentTime()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should return the current time using performance.now()', () => {
    vi.stubGlobal('performance', {
      now() {
        return Date.now();
      },
    } as Partial<Performance>);

    const now = Date.now();
    const performanceNowSpy = vi.spyOn(performance, 'now').mockReturnValue(now);
    const scheduler = getDefaultScheduler();

    expect(scheduler.getCurrentTime()).toBe(now);
    expect(performanceNowSpy).toHaveBeenCalledOnce();
  });

  it('should return the current time using Date.now()', () => {
    vi.stubGlobal('performance', undefined);

    const now = Date.now();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const scheduler = getDefaultScheduler();

    expect(scheduler.getCurrentTime()).toBe(now);
    expect(dateNowSpy).toHaveBeenCalledOnce();
  });
});

describe('requestCallback()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should schedule a callback with "user-blocking" priority using Scheduler.postTask()', () => {
    vi.stubGlobal('scheduler', {
      postTask(callback) {
        return callback();
      },
    } as Partial<Scheduler>);

    const callback = vi.fn();
    const options = { priority: 'user-blocking' } as const;
    const postTaskSpy = vi.spyOn(globalThis.scheduler, 'postTask');
    const scheduler = getDefaultScheduler();

    scheduler.requestCallback(callback, options);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith();
    expect(postTaskSpy).toHaveBeenCalledOnce();
    expect(postTaskSpy).toHaveBeenCalledWith(callback, options);
  });

  it('should schedule a callback with "user-blocking" priority using MessageChannel', async () => {
    vi.stubGlobal('scheduler', undefined);

    const callback = vi.fn();
    const setOnmessageSpy = vi.spyOn(MessagePort.prototype, 'onmessage', 'set');
    const postMessageSpy = vi.spyOn(MessagePort.prototype, 'postMessage');
    const scheduler = getDefaultScheduler();

    scheduler.requestCallback(callback, { priority: 'user-blocking' });

    await new Promise((resolve) => setTimeout(resolve));

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith();
    expect(setOnmessageSpy).toHaveBeenCalledOnce();
    expect(setOnmessageSpy).toHaveBeenCalledWith(expect.any(Function));
    expect(postMessageSpy).toHaveBeenCalledOnce();
    expect(postMessageSpy).toHaveBeenCalledWith(null);
  });

  it('should schedule a callback with "user-visible" priority using setTimeout()', () => {
    vi.stubGlobal('scheduler', undefined);

    const callback = vi.fn();
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((callback) => {
        callback();
        return 0 as any;
      });
    const scheduler = getDefaultScheduler();

    scheduler.requestCallback(callback);
    scheduler.requestCallback(callback, { priority: 'user-visible' });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledWith(callback);
  });

  it('should schedule a callback with "background" priority using setTimeout()', () => {
    vi.stubGlobal('scheduler', undefined);
    vi.stubGlobal('requestIdleCallback', undefined);

    const callback = vi.fn();
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((callback) => {
        callback();
        return 0 as any;
      });
    const scheduler = getDefaultScheduler();

    scheduler.requestCallback(callback);
    scheduler.requestCallback(callback, { priority: 'background' });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledWith(callback);
  });

  it('should schedule a callback with "background" priority using requestIdleCallback()', () => {
    vi.stubGlobal('scheduler', undefined);
    vi.stubGlobal('requestIdleCallback', ((callback) => {
      callback({} as IdleDeadline);
      return 0;
    }) as typeof requestIdleCallback);

    const callback = vi.fn();
    const requestIdleCallbackSpy = vi.spyOn(globalThis, 'requestIdleCallback');
    const scheduler = getDefaultScheduler();

    scheduler.requestCallback(callback, { priority: 'background' });

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith();
    expect(requestIdleCallbackSpy).toHaveBeenCalledOnce();
    expect(requestIdleCallbackSpy).toHaveBeenCalledWith(expect.any(Function));
  });
});

describe('shouldYieldToMain()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should return false if the elapsed time < 5ms', () => {
    vi.stubGlobal('navigator', {
      scheduling: {
        isInputPending() {
          return false;
        },
      },
    } as Partial<Navigator>);

    const scheduler = getDefaultScheduler();

    expect(scheduler.shouldYieldToMain(0)).toBe(false);
    expect(scheduler.shouldYieldToMain(4)).toBe(false);
  });

  it('should return the result of isInputPending() without continuous events if the elapsed time is between 5ms and 49ms', () => {
    vi.stubGlobal('navigator', {
      scheduling: {
        isInputPending() {
          return false;
        },
      },
    } as Partial<Navigator>);

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
    vi.stubGlobal('navigator', {
      scheduling: {
        isInputPending() {
          return false;
        },
      },
    } as Partial<Navigator>);

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
    vi.stubGlobal('navigator', {
      scheduling: {
        isInputPending() {
          return false;
        },
      },
    } as Partial<Navigator>);

    const scheduler = getDefaultScheduler();
    expect(scheduler.shouldYieldToMain(300)).toBe(true);
  });

  it('should return true if the elapsed time >= 5ms if isInputPending() is not available', () => {
    vi.stubGlobal('navigator', {});

    const scheduler = getDefaultScheduler();

    expect(scheduler.shouldYieldToMain(0)).toBe(false);
    expect(scheduler.shouldYieldToMain(4)).toBe(false);
    expect(scheduler.shouldYieldToMain(5)).toBe(true);
  });
});

describe('yieldToMain()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should return the promise by scheduler.yield()', async () => {
    vi.stubGlobal('scheduler', {
      yield() {
        return Promise.resolve();
      },
    } as Partial<Scheduler>);

    const scheduler = getDefaultScheduler();
    const yieldSpy = vi.spyOn(globalThis.scheduler, 'yield');

    expect(await scheduler.yieldToMain()).toBe(undefined);
    expect(yieldSpy).toHaveBeenCalledOnce();
  });

  it('should wait until the current callback has completed using setTimeout()', async () => {
    vi.stubGlobal('scheduler', undefined);

    const scheduler = getDefaultScheduler();
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((callback) => {
        callback();
        return 0 as any;
      });

    expect(await scheduler.yieldToMain()).toBe(undefined);
    expect(setTimeoutSpy).toHaveBeenCalledOnce();
  });
});
