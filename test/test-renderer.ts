import {
  BoundaryType,
  type ComponentState,
  type Coroutine,
  createScope,
  DETACHED_SCOPE,
  HookType,
  Lanes,
  type Scope,
  type UpdateOptions,
  type UpdateSession,
} from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import type { Runtime } from '@/runtime.js';
import { createRuntime } from './mocks.js';

export interface TestRendererOptions {
  runtime?: Runtime;
  scope?: Scope;
}

export interface RenderOptions extends UpdateOptions {
  coroutine?: Coroutine;
}

export class TestRenderer<TProps, TResult> implements Coroutine {
  readonly callback: (props: TProps, session: RenderSession) => TResult;

  readonly runtime: Runtime;

  scope: Scope;

  state: ComponentState = {
    hooks: [],
    pendingLanes: Lanes.NoLanes,
  };

  coroutine: (Coroutine & { pendingLanes: Lanes }) | null = null;

  constructor(
    callback: (props: TProps, session: RenderSession) => TResult,
    {
      runtime = createRuntime(),
      scope = createScope(),
    }: TestRendererOptions = {},
  ) {
    this.callback = callback;
    this.runtime = runtime;
    this.scope = scope;
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
    this.scope = DETACHED_SCOPE;
  }

  reset(): void {
    this.state = {
      hooks: [],
      pendingLanes: Lanes.NoLanes,
    };
    this.scope = createScope();
  }

  render(props: TProps, options: RenderOptions = {}): TResult {
    const { state, callback } = this;
    const scope = createScope(this.scope, this.scope.level + 1);
    const parentCoroutine = options.coroutine ?? this;

    let returnValue: TResult;
    let thrownError: unknown;

    const coroutine = {
      pendingLanes: Lanes.NoLanes,
      scope,
      resume({ frame, scope, context }: UpdateSession): void {
        const session = new RenderSession(
          state,
          parentCoroutine,
          frame,
          scope,
          context,
        );

        scope.boundary = {
          type: BoundaryType.Error,
          next: scope.boundary,
          handler: (error) => {
            thrownError = error;
          },
        };

        returnValue = callback(props, session);

        session.finalize();

        this.pendingLanes &= ~frame.lanes;
      },
    };

    const { lanes } = this.runtime.scheduleUpdate(coroutine, {
      flush: false,
      immediate: true,
      ...options,
    });

    coroutine.pendingLanes |= lanes;

    this.coroutine = coroutine;

    this.runtime.flushSync();

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return returnValue!;
  }
}
