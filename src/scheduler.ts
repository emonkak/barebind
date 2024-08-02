import type { TaskPriority } from './baseTypes.js';

export interface Scheduler {
  getCurrentTime(): number;
  requestCallback(
    callback: VoidFunction,
    options?: RequestCallbackOptions,
  ): void;
  shouldYieldToMain(elapsedTime: number): boolean;
  yieldToMain(options?: YieldToMainOptions): Promise<void>;
}

export interface RequestCallbackOptions {
  priority: TaskPriority;
}

export interface YieldToMainOptions {
  priority: TaskPriority | 'inherit';
}

const FRAME_YIELD_INTERVAL = 5;
const CONTINUOUS_INPUT_INTERVAL = 50;
const MAX_YIELD_INTERVAL = 300;

export function getDefaultScheduler(): Scheduler {
  let getCurrentTime: Scheduler['getCurrentTime'];
  let requestCallback: Scheduler['requestCallback'];
  let shouldYieldToMain: Scheduler['shouldYieldToMain'];
  let yieldToMain: Scheduler['yieldToMain'];

  if (typeof performance.now === 'function') {
    getCurrentTime = () => performance.now();
  } else {
    getCurrentTime = () => Date.now();
  }

  if (typeof scheduler.postTask === 'function') {
    requestCallback = (callback, options) =>
      scheduler.postTask(callback, options);
  } else {
    const requestBackgroundTask =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback
        : (callback: VoidFunction) => setTimeout(callback, 1);
    requestCallback = (callback, options) => {
      switch (options?.priority) {
        case 'user-blocking':
          queueMicrotask(callback);
          break;
        case 'background':
          requestBackgroundTask(callback);
          break;
        default:
          setTimeout(callback);
          break;
      }
    };
  }

  if (typeof navigator.scheduling?.isInputPending === 'function') {
    shouldYieldToMain = (elapsedTime) => {
      if (elapsedTime < FRAME_YIELD_INTERVAL) {
        return false;
      }
      if (elapsedTime < MAX_YIELD_INTERVAL) {
        const includeContinuous = elapsedTime >= CONTINUOUS_INPUT_INTERVAL;
        return navigator.scheduling.isInputPending({ includeContinuous });
      }
      return true;
    };
  } else {
    shouldYieldToMain = (elapsedTime) => {
      if (elapsedTime < FRAME_YIELD_INTERVAL) {
        return false;
      }
      return true;
    };
  }

  if (typeof scheduler.yield === 'function') {
    yieldToMain = (options) => scheduler.yield(options);
  } else {
    yieldToMain = () => new Promise((resolve) => setTimeout(resolve));
  }

  return {
    getCurrentTime,
    requestCallback,
    shouldYieldToMain,
    yieldToMain,
  };
}
