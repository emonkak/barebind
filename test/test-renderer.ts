import { vi } from 'vitest';
import {
  BOUNDARY_TYPE_ERROR,
  type Coroutine,
  HOOK_TYPE_INSERTION_EFFECT,
  HOOK_TYPE_LAYOUT_EFFECT,
  HOOK_TYPE_PASSIVE_EFFECT,
  type Hook,
  SCOPE_DETACHED,
  type Scope,
  type UpdateOptions,
} from '@/core.js';
import { NoLanes } from '@/lane.js';
import { RenderSession } from '@/render-session.js';
import type { Runtime } from '@/runtime.js';
import { createRuntime, createScope } from './mocks.js';

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
        hook.type === HOOK_TYPE_PASSIVE_EFFECT ||
        hook.type === HOOK_TYPE_LAYOUT_EFFECT ||
        hook.type === HOOK_TYPE_INSERTION_EFFECT
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

    if (this.scope !== SCOPE_DETACHED) {
      this.scope.boundary = {
        type: BOUNDARY_TYPE_ERROR,
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

    const coroutine: Coroutine = {
      name: this.callback.name,
      pendingLanes: NoLanes,
      scope: this.scope,
      start({ frame }) {
        frame.coroutines.push(this);
      },
      resume: ({ frame, context }) => {
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

    if (this.scope !== SCOPE_DETACHED) {
      this.scope.boundary = previousBoundary;
    }

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return returnValue!;
  }
}
