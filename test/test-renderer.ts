import { vi } from 'vitest';
import {
  BoundaryType,
  createScope,
  DETACHED_SCOPE,
  type Hook,
  HookType,
  Lane,
  type Scope,
  type UpdateOptions,
  type UpdateSession,
} from '@/core.js';
import { RenderSession } from '@/render-session.js';
import type { Runtime } from '@/runtime.js';
import { createRuntime } from './mocks.js';

export class TestRenderer<TProps = {}, TResult = unknown> {
  readonly callback: (props: TProps, session: RenderSession) => TResult;

  readonly runtime: Runtime = createRuntime();

  scope: Scope;

  hooks: Hook[] = [];

  constructor(
    callback: (props: TProps, session: RenderSession) => TResult,
    scope: Scope = createScope(),
  ) {
    this.callback = vi.fn(callback);
    this.scope = scope;
  }

  finalize(): void {
    for (const hook of this.hooks) {
      if (
        hook.type === HookType.PassiveEffect ||
        hook.type === HookType.LayoutEffect ||
        hook.type === HookType.InsertionEffect
      ) {
        hook.handler.cleanup?.();
        hook.handler.cleanup = undefined;
      }
    }
  }

  reset(): void {
    this.hooks = [];
  }

  render(props: TProps, options?: UpdateOptions): TResult {
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
        const scope = createScope(coroutine);
        const hooks = this.hooks.slice();
        const session = new RenderSession(
          hooks,
          frame,
          scope,
          coroutine,
          context,
        );

        returnValue = this.callback.call(undefined, props, session);

        session.finalize();

        this.hooks = hooks;
      },
    };

    this.runtime.scheduleUpdate(coroutine, {
      ...options,
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
