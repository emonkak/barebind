import { vi } from 'vitest';
import {
  BoundaryType,
  type ComponentState,
  createScope,
  DETACHED_SCOPE,
  HookType,
  Lane,
  type Scope,
  type UpdateSession,
} from '@/core.js';
import { RenderSession } from '@/render-session.js';
import type { Runtime } from '@/runtime.js';
import { createRuntime } from './mocks.js';

export class TestRenderer<TProps = {}, TResult = unknown> {
  readonly callback: (props: TProps, session: RenderSession) => TResult;

  readonly runtime: Runtime = createRuntime();

  scope: Scope;

  state: ComponentState = {
    hooks: [],
  };

  constructor(
    callback: (props: TProps, session: RenderSession) => TResult,
    scope: Scope = createScope(),
  ) {
    this.callback = vi.fn(callback);
    this.scope = scope;
  }

  finalize(): void {
    for (const hook of this.state.hooks) {
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

  reset(): void {
    this.state = {
      hooks: [],
    };
  }

  render(props: TProps): TResult {
    const { callback, state } = this;
    const previousBoundary = this.scope.boundary;
    let returnValue: TResult;
    let thrownError: unknown;

    if (this.scope !== DETACHED_SCOPE) {
      this.scope.boundary = {
        type: BoundaryType.Error,
        next: previousBoundary,
        handler: (error, handleError) => {
          try {
            handleError(error);
          } catch (error) {
            thrownError = error;
          }
        },
      };
    }

    const coroutine = {
      name: this.callback.name,
      pendingLanes: Lane.NoLane,
      scope: this.scope,
      resume: ({ frame, context }: UpdateSession): void => {
        const scope = createScope(this.scope, coroutine);
        const session = new RenderSession(
          state,
          frame,
          scope,
          coroutine,
          context,
        );

        returnValue = callback(props, session);

        session.finalize();
      },
    };

    this.runtime.scheduleUpdate(coroutine, {
      triggerFlush: false,
      immediate: true,
    });

    this.runtime.flushUpdates();

    if (this.scope !== DETACHED_SCOPE) {
      this.scope.boundary = previousBoundary;
    }

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return returnValue!;
  }
}
