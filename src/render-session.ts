import { sequentialEqual } from './compare.js';
import { DirectiveSpecifier } from './directive.js';
import {
  $hook,
  type Cleanup,
  type ComponentState,
  type Coroutine,
  type DispatchOptions,
  type Effect,
  type ErrorHandler,
  type Hook,
  HookType,
  type InitialState,
  Lanes,
  type NewState,
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
import {
  addErrorHandler,
  DETACHED_SCOPE,
  getSharedContext,
  setSharedContext,
} from './scope.js';

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
    addErrorHandler(this._scope, handler);
  }

  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createDynamicTemplate(strings, binds, 'html');
  }

  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createDynamicTemplate(strings, binds, 'math');
  }

  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createDynamicTemplate(strings, binds, 'svg');
  }

  finalize(): void {
    const { hooks } = this._state;
    const { mutationEffects, layoutEffects, passiveEffects } = this._frame;
    const currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.FinalizerHook>(HookType.Finalizer, currentHook);
    } else {
      hooks.push({ type: HookType.Finalizer });

      // Refuse to use new hooks after finalization.
      Object.freeze(hooks);
    }

    // Effects must run from child to parent, while preserving declaration
    // order within each component. To achieve this, we defer effect collection
    // until after rendering and then traverse hooks in reverse order.
    for (let i = hooks.length - 2; i >= 0; i--) {
      const hook = hooks[i]!;
      switch (hook.type) {
        case HookType.InsertionEffect:
          enqueueEffect(hook, mutationEffects);
          break;
        case HookType.LayoutEffect:
          enqueueEffect(hook, layoutEffects);
          break;
        case HookType.PassiveEffect:
          enqueueEffect(hook, passiveEffects);
          break;
      }
    }

    this._scope = DETACHED_SCOPE;
    this._hookIndex++;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (this._coroutine.scope === DETACHED_SCOPE) {
      return {
        lanes: Lanes.NoLanes,
        scheduled: Promise.resolve({ canceled: true, done: false }),
        finished: Promise.resolve({ canceled: true, done: false }),
      };
    }

    if (this._frame.lanes !== Lanes.NoLanes) {
      for (const { lanes, continuation } of this._context.getPendingTasks()) {
        this._frame.pendingCoroutines.push(this._coroutine);
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
    return getSharedContext(this._scope, key);
  }

  html(
    strings: TemplateStringsArray,
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
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, binds, 'math');
  }

  setSharedContext(key: unknown, value: unknown): void {
    setSharedContext(this._scope, key, value);
  }

  svg(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, binds, 'svg');
  }

  text(
    strings: TemplateStringsArray,
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
        typeof initialState === 'function' ? initialState() : initialState;
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
      newState: NewState<TState>,
      options?: DispatchOptions<TState>,
    ) => UpdateHandle,
    isPending: boolean,
  ] {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function' ? action(state) : action,
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

  private _createDynamicTemplate(
    strings: TemplateStringsArray,
    binds: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveSpecifier<readonly unknown[]> {
    const { strings: expandedStrings, values: expandedBinds } =
      this._context.expandLiterals(strings, binds);
    const template = this._context.resolveTemplate(
      expandedStrings,
      expandedBinds as unknown[],
      mode,
    );
    return new DirectiveSpecifier(template, expandedBinds);
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
        pendingDependencies: dependencies,
        memoizedDependencies: null,
        cleanup: undefined,
      };
      hooks.push(currentHook);
    }

    this._hookIndex++;
  }

  private _createTemplate(
    strings: TemplateStringsArray,
    binds: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveSpecifier<readonly unknown[]> {
    const template = this._context.resolveTemplate(strings, binds, mode);
    return new DirectiveSpecifier(template, binds);
  }
}

class InvokeEffectHook implements Effect {
  private readonly _hook: Hook.EffectHook;

  constructor(hook: Hook.EffectHook) {
    this._hook = hook;
  }

  commit(): void {
    const { cleanup, callback, pendingDependencies } = this._hook;
    cleanup?.();
    this._hook.cleanup = callback();
    this._hook.memoizedDependencies = pendingDependencies;
  }
}

function areDependenciesChanged(
  nextDependencies: readonly unknown[] | null,
  prevDependencies: readonly unknown[] | null,
): boolean {
  return (
    nextDependencies === null ||
    prevDependencies === null ||
    !sequentialEqual(nextDependencies, prevDependencies)
  );
}

function enqueueEffect(hook: Hook.EffectHook, effects: Effect[]): void {
  if (
    areDependenciesChanged(hook.pendingDependencies, hook.memoizedDependencies)
  ) {
    effects.push(new InvokeEffectHook(hook));
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
