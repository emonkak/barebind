import { vi } from 'vitest';
import {
  BOUNDARY_TYPE_ERROR,
  type Coroutine,
  Scope,
  type UpdateOptions,
} from '@/core.js';
import { NoLanes } from '@/lane.js';
import {
  HOOK_TYPE_INSERTION_EFFECT,
  HOOK_TYPE_LAYOUT_EFFECT,
  HOOK_TYPE_PASSIVE_EFFECT,
  type Hook,
  RenderContext,
} from '@/render-context.js';
import type { Runtime } from '@/runtime.js';
import { createRuntime } from './mocks.js';

export class TestRenderer<TProps = {}, TResult = unknown> {
  readonly callback: (props: TProps, session: RenderContext) => TResult;

  readonly runtime: Runtime = createRuntime();

  scope: Scope;

  hooks: Hook[] = [];

  constructor(
    callback: (props: TProps, session: RenderContext) => TResult,
    scope: Scope = Scope.Root({}),
  ) {
    this.callback = vi.fn(callback);
    this.scope = scope;
  }

  reset(): void {
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
    this.hooks = [];
  }

  render(props: TProps, options?: UpdateOptions): TResult {
    const renderer = this;
    const previousBoundary = this.scope.boundary;
    let returnValue: TResult;
    let thrownError: unknown;

    if (!this.scope.isOrphan()) {
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
      pendingLanes: NoLanes,
      get name() {
        return renderer.callback.name;
      },
      get scope() {
        return renderer.scope;
      },
      start({ frame }) {
        frame.coroutines.push(this);
      },
      resume({ frame, context }) {
        const scope = Scope.Child(coroutine);
        const hooks = renderer.hooks.slice();
        const session = new RenderContext(
          hooks,
          frame,
          scope,
          coroutine,
          context,
        );

        returnValue = renderer.callback.call(undefined, props, session);

        session.finalize();

        renderer.hooks = hooks;
      },
    };

    this.runtime.scheduleUpdate(coroutine, {
      ...options,
      triggerFlush: false,
      immediate: true,
    });

    this.runtime.flushUpdates();

    if (!this.scope.isOrphan()) {
      this.scope.boundary = previousBoundary;
    }

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return returnValue!;
  }
}
