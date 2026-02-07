import {
  BoundaryType,
  createScope,
  Lane,
  type Scope,
  type UpdateOptions,
  type UpdateSession,
} from '@/internal.js';
import type { Runtime } from '@/runtime.js';
import { createRuntime } from './mocks.js';

interface TestUpdateOptions extends UpdateOptions {
  scope?: Scope;
}

export class TestUpdater {
  readonly runtime;

  constructor(runtime: Runtime = createRuntime()) {
    this.runtime = runtime;
  }

  startUpdate<T>(
    callback: (session: UpdateSession) => T,
    options: TestUpdateOptions = {},
  ): T {
    let returnValue: T;
    let thrownError: unknown;

    const coroutine = {
      name: callback.name,
      pendingLanes: Lane.NoLane,
      scope: options.scope ?? createScope(),
      resume(session: UpdateSession): void {
        this.scope.boundary = {
          type: BoundaryType.Error,
          next: this.scope.boundary,
          handler: (error) => {
            thrownError = error;
          },
        };
        returnValue = callback(session);
        this.pendingLanes &= ~session.frame.lanes;
      },
    };

    const { lanes } = this.runtime.scheduleUpdate(coroutine, {
      triggerFlush: false,
      immediate: true,
      ...options,
    });

    coroutine.pendingLanes |= lanes;

    this.runtime.flushSync();

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return returnValue!;
  }
}
