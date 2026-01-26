import {
  BoundaryType,
  type Coroutine,
  createScope,
  type Hook,
  HookType,
  Lanes,
  type Scope,
  type UpdateOptions,
  type UpdateSession,
} from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import type { Runtime } from '@/runtime.js';
import { createRuntime } from './mocks.js';

interface TestRenderOptions extends UpdateOptions {
  scope?: Scope;
  coroutine?: Coroutine;
}

export class TestRenderer {
  readonly runtime: Runtime;

  hooks: Hook[] = [];

  constructor(runtime: Runtime = createRuntime()) {
    this.runtime = runtime;
  }

  finalizeHooks(): void {
    for (const hook of this.hooks) {
      if (
        hook.type === HookType.PassiveEffect ||
        hook.type === HookType.LayoutEffect ||
        hook.type === HookType.InsertionEffect
      ) {
        hook.cleanup?.();
        hook.cleanup = undefined;
      }
    }
  }

  startRender<T>(
    callback: (session: RenderSession) => T,
    options: TestRenderOptions = {},
  ): T {
    let returnValue: T;
    let thrownError: unknown;

    const state = {
      hooks: this.hooks,
      pendingLanes: Lanes.AllLanes,
    };
    const coroutine = {
      get pendingLanes(): Lanes {
        return state.pendingLanes;
      },
      scope: options.scope ?? createScope(),
      resume({ frame, scope, context }: UpdateSession): void {
        const session = new RenderSession(
          state,
          options.coroutine ?? coroutine,
          frame,
          scope,
          context,
        );

        this.scope.boundary = {
          type: BoundaryType.Error,
          next: this.scope.boundary,
          handler: (error) => {
            thrownError = error;
          },
        };

        returnValue = callback(session);

        session.finalize();

        state.pendingLanes &= ~frame.lanes;
      },
    };

    this.runtime.scheduleUpdate(coroutine, {
      flush: false,
      immediate: true,
      ...options,
    });

    this.runtime.flushSync();

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return returnValue!;
  }
}
