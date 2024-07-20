import type { TaskPriority } from './types.js';

export interface Scheduler {
  getCurrentTime(): number;
  requestCallback(callback: () => void, options?: RequestCallbackOptions): void;
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

  if (typeof globalThis.performance?.now === 'function') {
    getCurrentTime = () => performance.now();
  } else {
    getCurrentTime = () => Date.now();
  }

  if (typeof globalThis.scheduler?.postTask === 'function') {
    requestCallback = (callback, options) =>
      scheduler.postTask(callback, options);
  } else {
    const requestIdleCallback =
      typeof globalThis.requestIdleCallback === 'function'
        ? globalThis.requestIdleCallback
        : setTimeout;
    requestCallback = (callback, options) => {
      switch (options?.priority) {
        case 'user-blocking':
          queueMicrotask(callback);
          break;
        case 'background':
          requestIdleCallback(callback);
          break;
        default:
          setTimeout(callback);
          break;
      }
    };
  }

  if (typeof globalThis.navigator?.scheduling?.isInputPending === 'function') {
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

  if (typeof globalThis.scheduler?.yield === 'function') {
    yieldToMain = (options) => scheduler.yield(options);
  } else {
    yieldToMain = () => new Promise(queueMicrotask);
  }

  return {
    getCurrentTime,
    requestCallback,
    shouldYieldToMain,
    yieldToMain,
  };
}
