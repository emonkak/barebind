import { sequentialEqual } from './compare.js';
import { DirectiveSpecifier } from './directive.js';
import {
  $customHook,
  type Cleanup,
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
  Scope,
  type SessionContext,
  type TemplateMode,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type Usable,
} from './internal.js';

export class RenderSession implements RenderContext {
  private readonly _hooks: Hook[];

  private readonly _coroutine: Coroutine;

  private readonly _frame: RenderFrame;

  private _scope: Scope;

  private readonly _context: SessionContext;

  private _hookIndex = 0;

  constructor(
    hooks: Hook[],
    coroutine: Coroutine,
    frame: RenderFrame,
    scope: Scope,
    context: SessionContext,
  ) {
    this._hooks = hooks;
    this._coroutine = coroutine;
    this._frame = frame;
    this._scope = scope;
    this._context = context;
  }

  catchError(handler: ErrorHandler): void {
    this._scope.addErrorHandler(handler);
  }

  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._dynamicTemplate(strings, binds, 'html');
  }

  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._dynamicTemplate(strings, binds, 'math');
  }

  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._dynamicTemplate(strings, binds, 'svg');
  }

  finalize(): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.FinalizerHook>(HookType.Finalizer, currentHook);
    } else {
      this._hooks.push({ type: HookType.Finalizer });

      // Refuse to use new hooks after finalization.
      Object.freeze(this._hooks);
    }

    for (let i = 0, l = this._hooks.length; i < l; i++) {
      const headHook = this._hooks[i]!;
      const tailHook = this._hooks[l - i - 1]!;
      switch (headHook.type) {
        case HookType.PassiveEffect:
          if (
            areDependenciesChanged(
              headHook.pendingDependencies,
              headHook.memoizedDependencies,
            )
          ) {
            this._frame.passiveEffects.push(new InvokeEffectHook(headHook));
          }
          break;
      }
      switch (tailHook.type) {
        case HookType.LayoutEffect:
          if (
            areDependenciesChanged(
              tailHook.pendingDependencies,
              tailHook.memoizedDependencies,
            )
          ) {
            this._frame.layoutEffects.push(new InvokeEffectHook(tailHook));
          }
          break;
        case HookType.InsertionEffect:
          if (
            areDependenciesChanged(
              tailHook.pendingDependencies,
              tailHook.memoizedDependencies,
            )
          ) {
            this._frame.mutationEffects.push(new InvokeEffectHook(tailHook));
          }
          break;
      }
    }

    this._scope = Scope.DETACHED;
    this._hookIndex++;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (this._coroutine.scope === Scope.DETACHED) {
      return {
        lanes: Lanes.NoLanes,
        scheduled: Promise.resolve({ status: 'detached' }),
        finished: Promise.resolve({ status: 'detached' }),
      };
    }

    if (this._frame.lanes !== Lanes.NoLanes) {
      const runningTask = this._context.getPendingTasks().at(-1);
      if (runningTask !== undefined) {
        this._frame.pendingCoroutines.push(this._coroutine);
        return {
          lanes: runningTask.lanes,
          scheduled: Promise.resolve({ status: 'done' }),
          finished: runningTask.continuation.promise,
        };
      }
    }

    return this._context.scheduleUpdate(this._coroutine, options);
  }

  getSessionContext(): SessionContext {
    return this._context;
  }

  getSharedContext(key: unknown): unknown {
    return this._scope.getSharedContext(key);
  }

  html(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._template(strings, binds, 'html');
  }

  isUpdatePending(): boolean {
    const pendingTasks = this._context.getPendingTasks();

    for (let i = 0, l = pendingTasks.length; i < l; i++) {
      const pendingTask = pendingTasks[i]!;
      if (pendingTask.coroutine === this._coroutine) {
        return true;
      }
    }

    return false;
  }

  math(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._template(strings, binds, 'math');
  }

  setSharedContext(key: unknown, value: unknown): void {
    this._scope.setSharedContext(key, value);
  }

  svg(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._template(strings, binds, 'svg');
  }

  text(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._template(strings, binds, 'textarea');
  }

  use<T>(usable: Usable<T>): T {
    if ($customHook in usable) {
      return usable[$customHook](this);
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
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.IdHook>(HookType.Id, currentHook);
    } else {
      currentHook = {
        type: HookType.Id,
        id: this._context.nextIdentifier(),
      };
      this._hooks.push(currentHook);
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
    let currentHook = this._hooks[this._hookIndex];

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
      this._hooks.push(currentHook);
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
    let currentHook = this._hooks[this._hookIndex];

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
              scheduled: Promise.resolve({ status: 'canceled' }),
              finished: Promise.resolve({ status: 'canceled' }),
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
      this._hooks.push(hook);
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
    const pendingTasks = this._context.getPendingTasks();
    const promises: Promise<UpdateResult>[] = [];

    for (let i = 0, l = pendingTasks.length; i < l; i++) {
      const pendingTask = pendingTasks[i]!;
      if (pendingTask.coroutine === this._coroutine) {
        promises.push(pendingTask.continuation.promise);
      }
    }

    return (await Promise.allSettled(promises)).length;
  }

  private _createEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null,
    type: Hook.EffectHook['type'],
  ): void {
    let currentHook = this._hooks[this._hookIndex];

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
      this._hooks.push(currentHook);
    }

    this._hookIndex++;
  }

  private _dynamicTemplate(
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

  private _template(
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
