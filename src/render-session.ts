import { areDependenciesChanged } from './compare.js';
import {
  $hook,
  BoundaryType,
  type Cleanup,
  type ComponentState,
  type Coroutine,
  DETACHED_SCOPE,
  type DispatchOptions,
  type Effect,
  type EffectQueue,
  type ErrorHandler,
  getLanesFromOptions,
  type Hook,
  type HookClass,
  type HookFunction,
  type HookObject,
  HookType,
  type InitialState,
  Lane,
  type ReducerController,
  type RefObject,
  type RenderContext,
  type RenderFrame,
  type Scope,
  type SessionContext,
  type StateController,
  type TemplateMode,
  type TransitionAction,
  type TransitionHandle,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type Usable,
} from './core.js';
import { DirectiveSpecifier } from './directive.js';
import { handleError, InterruptError } from './error.js';

export class RenderSession implements RenderContext {
  private readonly _state: ComponentState;

  private readonly _frame: RenderFrame;

  private _scope: Scope;

  private readonly _coroutine: Coroutine;

  private readonly _context: SessionContext;

  private _hookIndex = 0;

  constructor(
    state: ComponentState,
    frame: RenderFrame,
    scope: Scope,
    coroutine: Coroutine,
    context: SessionContext,
  ) {
    this._state = state;
    this._frame = frame;
    this._scope = scope;
    this._coroutine = coroutine;
    this._context = context;
  }

  catchError(handler: ErrorHandler): void {
    this._scope.boundary = {
      type: BoundaryType.Error,
      next: this._scope.boundary,
      handler,
    };
  }

  finalize(): void {
    const { hooks } = this._state;
    const currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.FinalizerHook>(HookType.Finalizer, currentHook);
    } else {
      hooks.push({ type: HookType.Finalizer });

      // Refuse to use new hooks after finalization.
      Object.freeze(hooks);
    }

    // Refuse to mutate scope after finalization.
    Object.freeze(this._scope);

    this._scope = DETACHED_SCOPE;
    this._hookIndex++;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (this._coroutine.scope === DETACHED_SCOPE) {
      const skipped = Promise.resolve<UpdateResult>({ status: 'skipped' });
      return {
        id: this._frame.id,
        lanes: Lane.NoLane,
        scheduled: skipped,
        finished: skipped,
      };
    }

    const renderLanes = this._frame.lanes;

    if (renderLanes !== Lane.NoLane) {
      // We reuse the frame only for updates within the same lanes, which
      // avoids scheduling a new update during rendering. This is generally
      // undesirable, but necessary when an ErrorBoundary catches an error and
      // sets new state.
      const requestLanes = getLanesFromOptions(options ?? {});

      if ((renderLanes & requestLanes) === requestLanes) {
        for (const { id, controller } of this._context.getScheduledUpdates()) {
          if (id === this._frame.id) {
            this._frame.pendingCoroutines.push(this._coroutine);
            this._coroutine.pendingLanes |= renderLanes;
            return {
              id: this._frame.id,
              lanes: renderLanes,
              scheduled: Promise.resolve({ status: 'skipped' }),
              finished: controller.promise,
            };
          }
        }
      }
    }

    return this._context.scheduleUpdate(this._coroutine, options);
  }

  getSessionContext(): SessionContext {
    return this._context;
  }

  getSharedContext<T>(key: unknown): T | undefined {
    let currentScope: Scope | null = this._scope;
    while (true) {
      for (
        let boundary = currentScope.boundary;
        boundary !== null;
        boundary = boundary.next
      ) {
        if (
          boundary.type === BoundaryType.SharedContext &&
          Object.is(boundary.key, key)
        ) {
          return boundary.value as T;
        }
      }
      if (currentScope.owner === null) {
        break;
      }
      currentScope = currentScope.owner.scope;
    }
    return undefined;
  }

  html(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, values, 'html');
  }

  interrupt(error: unknown): void {
    try {
      handleError(error, this._coroutine.scope);
    } catch (error) {
      throw new InterruptError(
        this._coroutine,
        'An error was thrown from the component.',
        { cause: error },
      );
    }
  }

  math(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, values, 'math');
  }

  setSharedContext<T>(key: unknown, value: T): void {
    this._scope.boundary = {
      type: BoundaryType.SharedContext,
      next: this._scope.boundary,
      key,
      value,
    };
  }

  startTransition(action: TransitionAction): TransitionHandle {
    return this._context.startTransition(async (transition) => {
      try {
        await action(transition);
      } catch (error) {
        try {
          handleError(error, this._coroutine.scope);
        } catch (error) {
          throw new InterruptError(
            this._coroutine,
            'An error occurred during a transition.',
            { cause: error },
          );
        }
      }
    });
  }

  svg(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, values, 'svg');
  }

  text(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, values, 'textarea');
  }

  use<T>(usable: HookClass<T>): T;
  use<T>(usable: HookObject<T>): T;
  use<T>(usable: HookFunction<T>): T;
  use<T>(usable: Usable<T>): T {
    if ($hook in usable) {
      return usable[$hook](this);
    } else {
      return usable(this);
    }
  }

  useCallback<TCallback extends (...args: any[]) => any>(
    callback: TCallback,
    dependencies: readonly unknown[],
  ): TCallback {
    return this.useMemo(() => callback, dependencies);
  }

  useEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null = null,
  ): void {
    this._createEffect(
      callback,
      dependencies,
      HookType.PassiveEffect,
      this._frame.passiveEffects,
    );
  }

  useId(): string {
    const { hooks } = this._state;
    let currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.IdHook>(HookType.Id, currentHook);
    } else {
      currentHook = {
        type: HookType.Id,
        id: this._context.nextIdentifier(),
      };
      hooks.push(currentHook);
    }

    this._hookIndex++;

    return currentHook.id;
  }

  useInsertionEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null = null,
  ): void {
    this._createEffect(
      callback,
      dependencies,
      HookType.InsertionEffect,
      this._frame.mutationEffects,
    );
  }

  useLayoutEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null = null,
  ): void {
    this._createEffect(
      callback,
      dependencies,
      HookType.LayoutEffect,
      this._frame.layoutEffects,
    );
  }

  useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T {
    const { hooks } = this._state;
    let currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.MemoHook<T>>(HookType.Memo, currentHook);

      if (areDependenciesChanged(dependencies, currentHook.dependencies)) {
        currentHook.value = factory();
        currentHook.dependencies = dependencies;
      }
    } else {
      currentHook = {
        type: HookType.Memo,
        value: factory(),
        dependencies,
      };
      hooks.push(currentHook);
    }

    this._hookIndex++;

    return currentHook.value as T;
  }

  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
  ): ReducerController<TState, TAction> {
    const { hooks } = this._state;
    let currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.ReducerHook<TState, TAction>>(
        HookType.Reducer,
        currentHook,
      );
      if (
        (currentHook.pendingLanes & this._frame.lanes) ===
        currentHook.pendingLanes
      ) {
        currentHook.pendingLanes = Lane.NoLane;
        currentHook.memoizedState = currentHook.pendingState;
      }
      currentHook.reducer = reducer;
      currentHook.context = this;
    } else {
      const state =
        typeof initialState === 'function'
          ? (initialState as () => TState)()
          : initialState;
      const hook: Hook.ReducerHook<TState, TAction> = {
        type: HookType.Reducer,
        reducer,
        dispatch: (
          action: TAction,
          options: DispatchOptions<TState> = {},
        ): UpdateHandle => {
          const { reducer, pendingState, context } = hook;
          const areStatesEqual = options.areStatesEqual ?? Object.is;
          const nextState = reducer(pendingState, action);

          if (areStatesEqual(nextState, pendingState)) {
            const skipped = Promise.resolve<UpdateResult>({
              status: 'skipped',
            });
            return {
              id: this._frame.id,
              lanes: Lane.NoLane,
              scheduled: skipped,
              finished: skipped,
            };
          } else {
            const handle = context.forceUpdate(options);
            hook.pendingLanes = handle.lanes;
            hook.pendingState = nextState;
            return handle;
          }
        },
        pendingLanes: Lane.NoLane,
        pendingState: state,
        memoizedState: state,
        context: this,
      };
      currentHook = hook;
      hooks.push(hook);
    }

    this._hookIndex++;

    return [
      currentHook.memoizedState,
      currentHook.dispatch,
      currentHook.pendingLanes !== Lane.NoLane,
    ];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => Object.seal({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
  ): StateController<TState> {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function'
          ? (action as (prevState: TState) => TState)(state)
          : action,
      initialState,
    );
  }

  private _createEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null,
    type: Hook.EffectHook['type'],
    effects: EffectQueue,
  ): void {
    const { hooks } = this._state;
    let currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.EffectHook>(type, currentHook);
      currentHook.callback = callback;
      currentHook.pendingDependencies = dependencies;
      if (
        areDependenciesChanged(dependencies, currentHook.memoizedDependencies)
      ) {
        currentHook.epoch++;
        effects.push(new InvokeEffectHook(currentHook), this._scope.level);
      }
    } else {
      currentHook = {
        type,
        callback,
        cleanup: undefined,
        epoch: 0,
        memoizedDependencies: null,
        pendingDependencies: dependencies,
      };
      hooks.push(currentHook);
      effects.push(new InvokeEffectHook(currentHook), this._scope.level);
    }

    this._hookIndex++;
  }

  private _createTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveSpecifier<readonly unknown[]> {
    const template = this._context.resolveTemplate(strings, values, mode);
    return new DirectiveSpecifier(template, values);
  }
}

class InvokeEffectHook implements Effect {
  private readonly _hook: Hook.EffectHook;

  private readonly _epoch: number;

  constructor(hook: Hook.EffectHook) {
    this._hook = hook;
    this._epoch = hook.epoch;
  }

  commit(): void {
    const { callback, cleanup, epoch } = this._hook;

    if (epoch === this._epoch) {
      cleanup?.();
      this._hook.cleanup = callback();
      this._hook.memoizedDependencies = this._hook.pendingDependencies;
    }
  }
}

function ensureHookType<TExpectedHook extends Hook>(
  expectedType: TExpectedHook['type'],
  hook: Hook,
): asserts hook is TExpectedHook {
  if (hook.type !== expectedType) {
    throw new Error(
      `Unexpected hook type. Expected "${expectedType}" but got "${hook.type}".`,
    );
  }
}
