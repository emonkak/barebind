import { areDependenciesChanged } from './compare.js';
import { DirectiveSpecifier } from './directive.js';
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
  type Hook,
  HookType,
  type InitialState,
  Lanes,
  type NextState,
  type RefObject,
  type RenderContext,
  type RenderFrame,
  type Scope,
  type SessionContext,
  type TemplateMode,
  type UpdateHandle,
  type UpdateOptions,
  type Usable,
} from './internal.js';

export class RenderSession implements RenderContext {
  private readonly _state: ComponentState;

  private readonly _coroutine: Coroutine;

  private readonly _frame: RenderFrame;

  private _scope: Scope;

  private readonly _context: SessionContext;

  private _hookIndex = 0;

  constructor(
    state: ComponentState,
    coroutine: Coroutine,
    frame: RenderFrame,
    scope: Scope,
    context: SessionContext,
  ) {
    this._state = state;
    this._coroutine = coroutine;
    this._frame = frame;
    this._scope = scope;
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

    this._scope = DETACHED_SCOPE;
    this._hookIndex++;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (this._state.scope === DETACHED_SCOPE) {
      return {
        lanes: Lanes.NoLanes,
        scheduled: Promise.resolve({ canceled: true, done: false }),
        finished: Promise.resolve({ canceled: true, done: false }),
      };
    }

    if (this._frame.lanes !== Lanes.NoLanes) {
      for (const { lanes, continuation } of this._context.getPendingTasks()) {
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
    let currentScope: Scope | null = this._scope;
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
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, binds, 'html');
  }

  isUpdatePending(): boolean {
    return this._context
      .getPendingTasks()
      .some((pendingTask) => pendingTask.coroutine === this._coroutine);
  }

  math(
    strings: readonly string[],
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, binds, 'math');
  }

  setSharedContext(key: unknown, value: unknown): void {
    this._scope.boundary = {
      type: BoundaryType.SharedContext,
      next: this._scope.boundary,
      key,
      value,
    };
  }

  svg(
    strings: readonly string[],
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, binds, 'svg');
  }

  text(
    strings: readonly string[],
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, binds, 'textarea');
  }

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
  ): [
    state: TState,
    dispatch: (
      action: TAction,
      options?: DispatchOptions<TState>,
    ) => UpdateHandle,
    isPending: boolean,
  ] {
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
        currentHook.pendingLanes = Lanes.NoLanes;
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
              lanes: Lanes.NoLanes,
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
        pendingLanes: Lanes.NoLanes,
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
      currentHook.pendingLanes !== Lanes.NoLanes,
    ];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => Object.seal({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
  ): [
    state: TState,
    setState: (
      nextState: NextState<TState>,
      options?: DispatchOptions<TState>,
    ) => UpdateHandle,
    isPending: boolean,
  ] {
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
      .getPendingTasks()
      .filter((pendingTask) => pendingTask.coroutine === this._coroutine)
      .map((pendingTask) => pendingTask.continuation.promise);
    return (await Promise.allSettled(promises)).length;
  }

  private _createEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null,
    type: Hook.EffectHook['type'],
    effects: EffectQueue,
  ): void {
    const { hooks } = this._state;
    const { level } = this._scope;
    let currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.EffectHook>(type, currentHook);
      currentHook.callback = callback;
      currentHook.pendingDependencies = dependencies;
      if (
        areDependenciesChanged(dependencies, currentHook.memoizedDependencies)
      ) {
        currentHook.epoch++;
        effects.push(new InvokeEffectHook(currentHook), level);
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
      effects.push(new InvokeEffectHook(currentHook), level);
    }

    this._hookIndex++;
  }

  private _createTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveSpecifier<readonly unknown[]> {
    const template = this._context.resolveTemplate(strings, binds, mode);
    return new DirectiveSpecifier(template, binds);
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
      this._hook.epoch++;
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
