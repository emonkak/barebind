import {
  BoundaryType,
  type Coroutine,
  createScope,
  type Scope,
  type UpdateOptions,
  type UpdateSession,
} from '@/core.js';
import { NoLanes } from '@/lane.js';
import type { Runtime } from '@/runtime.js';
import { createRuntime } from './mocks.js';

export class TestUpdater {
  readonly scope: Scope;

  readonly runtime: Runtime = createRuntime();

  constructor(scope: Scope = createScope()) {
    this.scope = scope;
  }

  startUpdate<T>(
    callback: (session: UpdateSession) => T,
    options?: UpdateOptions,
  ): T {
    const previousBoundary = this.scope.boundary;
    let returnValue: T;
    let thrownError: unknown;

    this.scope.boundary = {
      type: BoundaryType.Error,
      next: previousBoundary,
      handler: (error) => {
        thrownError = error;
      },
    };

    const coroutine: Coroutine = {
      name: callback.name,
      pendingLanes: NoLanes,
      scope: this.scope,
      start(session) {
        session.frame.coroutines.push(this);
      },
      resume(session) {
        returnValue = callback(session);
      },
    };

    this.runtime.scheduleUpdate(coroutine, {
      triggerFlush: false,
      immediate: true,
      ...options,
    });

    this.runtime.flushUpdates();

    this.scope.boundary = previousBoundary;

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return returnValue!;
  }
}
