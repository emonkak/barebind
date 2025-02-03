/// <reference path="../typings/navigator.d.ts" />
/// <reference path="../typings/scheduler.d.ts" />

export interface Scheduler {
  getCurrentTime(): number;
  requestCallback(callback: () => void, options?: RequestCallbackOptions): void;
  shouldYieldToMain(elapsedTime: number): boolean;
  yieldToMain(): Promise<void>;
}

export interface SchedulerOptions {
  frameYieldInterval?: number;
  continuousInputInterval?: number;
  maxYieldInterval?: number;
}

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}

export function getScheduler({
  frameYieldInterval = 5,
  continuousInputInterval = 50,
  maxYieldInterval = 300,
}: SchedulerOptions = {}): Scheduler {
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
    requestCallback = (callback, { priority } = {}) => {
      if (priority === 'user-blocking') {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => callback();
        channel.port2.postMessage(null);
        return;
      }
      if (
        priority === 'background' &&
        typeof requestIdleCallback === 'function'
      ) {
        requestIdleCallback(() => callback());
        return;
      }
      setTimeout(callback);
    };
  }

  if (typeof globalThis.navigator?.scheduling?.isInputPending === 'function') {
    shouldYieldToMain = (elapsedTime) => {
      if (elapsedTime < frameYieldInterval) {
        return false;
      }
      if (elapsedTime < maxYieldInterval) {
        const includeContinuous = elapsedTime >= continuousInputInterval;
        return navigator.scheduling.isInputPending({ includeContinuous });
      }
      return true;
    };
  } else {
    shouldYieldToMain = (elapsedTime) => {
      if (elapsedTime < frameYieldInterval) {
        return false;
      }
      return true;
    };
  }

  if (typeof globalThis.scheduler?.yield === 'function') {
    yieldToMain = () => scheduler.yield();
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
