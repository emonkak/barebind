import {
  BOUNDARY_TYPE_ERROR,
  type Coroutine,
  Scope,
  type Session,
  type UpdateOptions,
} from '@/core.js';
import { NoLanes } from '@/lane.js';
import type { Runtime } from '@/runtime.js';

export class SessionLauncher<TPart, TRenderer> {
  readonly runtime: Runtime<TPart, TRenderer>;

  readonly scope: Scope;

  constructor(runtime: Runtime<TPart, TRenderer>, scope: Scope = Scope.Root()) {
    this.runtime = runtime;
    this.scope = scope;
  }

  launchSession<T>(
    callback: (session: Session<TPart, TRenderer>) => T,
    options?: UpdateOptions,
  ): T {
    const previousBoundary = this.scope.boundary;
    let returnValue: T;
    let thrownError: unknown;

    this.scope.boundary = {
      type: BOUNDARY_TYPE_ERROR,
      next: previousBoundary,
      handler: (error) => {
        thrownError = error;
      },
    };

    const coroutine: Coroutine<TPart, TRenderer> = {
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
