import {
  BoundaryType,
  type ComponentState,
  type Coroutine,
  createScope,
  DETACHED_SCOPE,
  HookType,
  Lane,
  type Lanes,
  type Scope,
  type UpdateSession,
} from '@/core.js';
import { RenderError } from '@/error.js';
import { RenderSession } from '@/render-session.js';
import type { Runtime } from '@/runtime.js';
import { createRuntime } from './mocks.js';

export class TestRenderer<TProps, TResult> implements Coroutine {
  readonly callback: (props: TProps, session: RenderSession) => TResult;

  scope: Scope;

  state: ComponentState = {
    hooks: [],
    pendingLanes: Lane.NoLane,
    scope: DETACHED_SCOPE,
  };

  coroutine: Coroutine | null = null;

  readonly runtime: Runtime = createRuntime();

  constructor(
    callback: (props: TProps, session: RenderSession) => TResult,
    scope: Scope = createScope(),
  ) {
    this.callback = callback;
    this.scope = scope;
  }

  get name(): string {
    return TestRenderer.name;
  }

  get pendingLanes(): Lanes {
    return this.state.pendingLanes;
  }

  resume(session: UpdateSession): void {
    this.coroutine?.resume(session);
    this.state.pendingLanes &= ~session.frame.lanes;
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
    this.state.scope = DETACHED_SCOPE;
  }

  reset(): void {
    this.state = {
      hooks: [],
      pendingLanes: Lane.NoLane,
      scope: createScope(),
    };
  }

  render(props: TProps): TResult {
    const { state, callback } = this;
    const scope = createScope(this.scope);
    const that = this;

    let returnValue: TResult;
    let thrownError: unknown;

    scope.boundary = {
      type: BoundaryType.Error,
      next: scope.boundary,
      handler: (error, handleError) => {
        try {
          handleError(error);
        } catch (error) {
          thrownError = error instanceof RenderError ? error.cause : error;
        }
      },
    };

    const coroutine = {
      name: this.callback.name,
      pendingLanes: Lane.NoLane,
      scope,
      resume({ frame, scope, context }: UpdateSession): void {
        state.scope = createScope(scope);

        const session = new RenderSession(state, that, frame, context);

        returnValue = callback(props, session);

        session.finalize();

        this.pendingLanes &= ~frame.lanes;
      },
    };

    this.coroutine = coroutine;

    const { lanes } = this.runtime.scheduleUpdate(this.coroutine, {
      triggerFlush: false,
      immediate: true,
    });

    coroutine.pendingLanes |= lanes;

    this.runtime.flushUpdates();

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return returnValue!;
  }
}
