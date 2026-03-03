import { areDependenciesChanged } from './compare.js';
import { DirectiveSpecifier } from './directive.js';
import { handleError } from './error.js';
import {
  $hook,
  type Action,
  BoundaryType,
  type Cleanup,
  type ComponentState,
  type Coroutine,
  DETACHED_SCOPE,
  type DispatchOptions,
  type Effect,
  type EffectQueue,
  type ErrorHandler,
  type Hook,
  type HookClass,
  type HookFunction,
  type HookObject,
  HookType,
  type InitialState,
  Lane,
  type ReducerHandle,
  type RefObject,
  type RenderContext,
  type RenderFrame,
  type Scope,
  type SessionContext,
  type StateHandle,
  type TemplateMode,
  type UpdateHandle,
  type UpdateOptions,
  type Usable,
} from './internal.js';

export class RenderSession implements RenderContext {
  private readonly _state: ComponentState;

  private readonly _coroutine: Coroutine;

  private readonly _frame: RenderFrame;

  private readonly _context: SessionContext;

  private _hookIndex = 0;

  constructor(
    state: ComponentState,
    coroutine: Coroutine,
    frame: RenderFrame,
    context: SessionContext,
  ) {
    this._state = state;
    this._coroutine = coroutine;
    this._frame = frame;
    this._context = context;
  }

  async attempt(action: Action): Promise<void> {
    try {
      await action();
    } catch (error) {
      handleError(error, this._coroutine, this._state.scope);
    }
  }

  catchError(handler: ErrorHandler): void {
    const { scope } = this._state;
    scope.boundary = {
      type: BoundaryType.Error,
      next: scope.boundary,
      handler,
    };
  }

  finalize(): void {
    const { hooks, scope } = this._state;
    const currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.FinalizerHook>(HookType.Finalizer, currentHook);
    } else {
      hooks.push({ type: HookType.Finalizer });

      // Refuse to use new hooks after finalization.
      Object.freeze(hooks);
    }

    // Refuse to mutate scope after finalization.
    Object.freeze(scope);

    // Enqueue effects during finalization to avoid running them on render
    // errors.
    for (let i = 0, l = hooks.length - 1; i < l; i++) {
      const hook = hooks[i]!;
      switch (hook.type) {
        case HookType.InsertionEffect:
          enqueueEffect(this._frame.mutationEffects, hook, scope.level);
          break;
        case HookType.LayoutEffect:
          enqueueEffect(this._frame.layoutEffects, hook, scope.level);
          break;
        case HookType.PassiveEffect:
          enqueueEffect(this._frame.passiveEffects, hook, scope.level);
          break;
      }
    }

    this._hookIndex++;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (this._coroutine.scope === DETACHED_SCOPE) {
      return {
        lanes: Lane.NoLane,
        scheduled: Promise.resolve({ canceled: true, done: false }),
        finished: Promise.resolve({ canceled: true, done: false }),
      };
    }

    if (this._frame.lanes !== Lane.NoLane) {
      for (const { lanes, continuation } of this._context.getPendingUpdates()) {
        this._frame.pendingCoroutines.push(this._coroutine);
        this._state.pendingLanes |= lanes;
        return {
          lanes,
          scheduled: Promise.resolve({ canceled: true, done: true }),
          finished: continuation.promise,
        };
      }
    }

    const handle = this._context.scheduleUpdate(this._coroutine, options);

    this._state.pendingLanes |= handle.lanes;

    return handle;
  }

  getSessionContext(): SessionContext {
    return this._context;
  }

  getSharedContext(key: unknown): unknown {
    let currentScope: Scope | null = this._state.scope;
    do {
      for (
        let boundary = currentScope.boundary;
        boundary !== null;
        boundary = boundary.next
      ) {
        if (
          boundary.type === BoundaryType.SharedContext &&
          Object.is(boundary.key, key)
        ) {
          return boundary.value;
        }
      }
      currentScope = currentScope.parent;
    } while (currentScope !== null);
    return undefined;
  }

  html(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, values, 'html');
  }

  isUpdatePending(): boolean {
    return this._context
      .getPendingUpdates()
      .some((pendingUpdate) => pendingUpdate.coroutine === this._coroutine);
  }

  math(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, values, 'math');
  }

  setSharedContext(key: unknown, value: unknown): void {
    const { scope } = this._state;
    scope.boundary = {
      type: BoundaryType.SharedContext,
      next: scope.boundary,
      key,
      value,
    };
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

  throwError(error: unknown): void {
    handleError(error, this._coroutine, this._state.scope);
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
    this._createEffect(callback, dependencies, HookType.PassiveEffect);
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
    this._createEffect(callback, dependencies, HookType.InsertionEffect);
  }

  useLayoutEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null = null,
  ): void {
    this._createEffect(callback, dependencies, HookType.LayoutEffect);
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
  ): ReducerHandle<TState, TAction> {
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
          const areStatesEqual = options.areStatesEqual ?? Object.is;
          const prevState = hook.pendingState;
          const nextState = hook.reducer(prevState, action);

          if (areStatesEqual(nextState, prevState)) {
            return {
              lanes: Lane.NoLane,
              scheduled: Promise.resolve({ canceled: true, done: true }),
              finished: Promise.resolve({ canceled: true, done: true }),
            };
          } else {
            const handle = this.forceUpdate(options);
            hook.pendingLanes = handle.lanes;
            hook.pendingState = nextState;
            return handle;
          }
        },
        pendingLanes: Lane.NoLane,
        pendingState: state,
        memoizedState: state,
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

  useState<TState>(initialState: InitialState<TState>): StateHandle<TState> {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function'
          ? (action as (prevState: TState) => TState)(state)
          : action,
      initialState,
    );
  }

  async waitForUpdate(): Promise<number> {
    const promises = this._context
      .getPendingUpdates()
      .filter((pendingUpdate) => pendingUpdate.coroutine === this._coroutine)
      .map((pendingUpdate) => pendingUpdate.continuation.promise);
    return (await Promise.allSettled(promises)).length;
  }

  private _createEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null,
    type: Hook.EffectHook['type'],
  ): void {
    const { hooks } = this._state;
    let currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.EffectHook>(type, currentHook);
      currentHook.callback = callback;
      currentHook.pendingDependencies = dependencies;
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

function enqueueEffect(
  effects: EffectQueue,
  hook: Hook.EffectHook,
  level: number,
): void {
  if (
    areDependenciesChanged(hook.pendingDependencies, hook.memoizedDependencies)
  ) {
    hook.epoch++;
    effects.push(new InvokeEffectHook(hook), level);
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
