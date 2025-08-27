import { sequentialEqual } from './compare.js';
import { DirectiveSpecifier } from './directive.js';
import {
  $customHook,
  type Cleanup,
  type Coroutine,
  createScope,
  type Effect,
  getSharedContext,
  type Hook,
  HookType,
  type InitialState,
  Lanes,
  type NewState,
  type RefObject,
  type RenderContext,
  type ScheduleOptions,
  type Scope,
  type SessionContext,
  setSharedContext,
  type TemplateMode,
  type UpdateFrame,
  type UpdateHandle,
  type Usable,
} from './internal.js';

const DETACHED_FRAME: UpdateFrame = {
  id: -1,
  lanes: Lanes.NoLanes,
  pendingCoroutines: [],
  mutationEffects: [],
  layoutEffects: [],
  passiveEffects: [],
};

const DETACHED_SCOPE = createScope();

export class RenderSession implements RenderContext {
  private readonly _hooks: Hook[];

  private readonly _coroutine: Coroutine;

  private _frame: UpdateFrame;

  private _scope: Scope;

  private readonly _runtime: SessionContext;

  private _hookIndex = 0;

  constructor(
    hooks: Hook[],
    coroutine: Coroutine,
    frame: UpdateFrame,
    scope: Scope,
    runtime: SessionContext,
  ) {
    this._hooks = hooks;
    this._coroutine = coroutine;
    this._frame = frame;
    this._scope = scope;
    this._runtime = runtime;
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

    this._frame = DETACHED_FRAME;
    this._scope = DETACHED_SCOPE;
    this._hookIndex++;
  }

  forceUpdate(options?: ScheduleOptions): UpdateHandle {
    return this._runtime.scheduleUpdate(this._coroutine, options);
  }

  getSharedContext(key: unknown): unknown {
    if (this._scope === DETACHED_SCOPE) {
      throw new Error('Shared contexts are only available during rendering.');
    }

    return getSharedContext(this._scope, key);
  }

  html(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._template(strings, binds, 'html');
  }

  isUpdatePending(): boolean {
    const pendingTasks = this._runtime.getPendingTasks();

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
    if (this._scope === DETACHED_SCOPE) {
      throw new Error('Shared contexts can only be set during rendering.');
    }

    setSharedContext(this._scope, key, value);
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
    dependencies?: readonly unknown[],
  ): void {
    this._useEffect(callback, dependencies ?? null, HookType.Effect);
  }

  useId(): string {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.IdHook>(HookType.Id, currentHook);
    } else {
      currentHook = {
        type: HookType.Id,
        id: this._runtime.nextIdentifier(),
      };
      this._hooks.push(currentHook);
    }

    this._hookIndex++;

    return currentHook.id;
  }

  useInsertionEffect(
    callback: () => Cleanup | void,
    dependencies?: readonly unknown[],
  ): void {
    this._useEffect(callback, dependencies ?? null, HookType.InsertionEffect);
  }

  useLayoutEffect(
    callback: () => Cleanup | void,
    dependencies?: readonly unknown[],
  ): void {
    this._useEffect(callback, dependencies ?? null, HookType.LayoutEffect);
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
    dispatch: (action: TAction, options?: ScheduleOptions) => void,
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
        dispatch: (action: TAction, options?: ScheduleOptions) => {
          const prevState = hook.memoizedState;
          const nextState = hook.reducer(prevState, action);

          if (!Object.is(nextState, prevState)) {
            const { lanes } = this.forceUpdate(options);
            hook.pendingLanes = lanes;
            hook.pendingState = nextState;
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
    setState: (newState: NewState<TState>, options?: ScheduleOptions) => void,
    isPending: boolean,
  ] {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function' ? action(state) : action,
      initialState,
    );
  }

  async waitForUpdate(): Promise<number> {
    const pendingTasks = this._runtime.getPendingTasks();
    const promises: Promise<void>[] = [];

    for (let i = 0, l = pendingTasks.length; i < l; i++) {
      const pendingTask = pendingTasks[i]!;
      if (pendingTask.coroutine === this._coroutine) {
        promises.push(pendingTask.continuation.promise);
      }
    }

    return (await Promise.allSettled(promises)).length;
  }

  private _dynamicTemplate(
    strings: TemplateStringsArray,
    binds: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveSpecifier<readonly unknown[]> {
    const { strings: expandedStrings, values: expandedBinds } =
      this._runtime.expandLiterals(strings, binds);
    const template = this._runtime.resolveTemplate(
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
    const template = this._runtime.resolveTemplate(strings, binds, mode);
    return new DirectiveSpecifier(template, binds);
  }

  private _useEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null,
    type: Hook.EffectHook['type'],
  ): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.EffectHook>(type, currentHook);
      if (areDependenciesChanged(dependencies, currentHook.dependencies)) {
        enqueueEffect(this._frame, currentHook);
      }
      currentHook.callback = callback;
      currentHook.dependencies = dependencies;
    } else {
      const hook: Hook.EffectHook = {
        type,
        callback,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      enqueueEffect(this._frame, hook);
    }

    this._hookIndex++;
  }
}

class InvokeEffectHook implements Effect {
  private readonly _hook: Hook.EffectHook;

  constructor(hook: Hook.EffectHook) {
    this._hook = hook;
  }

  commit(): void {
    const { cleanup, callback } = this._hook;
    cleanup?.();
    this._hook.cleanup = callback();
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

function enqueueEffect(frame: UpdateFrame, hook: Hook.EffectHook): void {
  const effect = new InvokeEffectHook(hook);
  switch (hook.type) {
    case HookType.Effect:
      frame.passiveEffects.push(effect);
      break;
    case HookType.LayoutEffect:
      frame.layoutEffects.push(effect);
      break;
    case HookType.InsertionEffect:
      frame.mutationEffects.push(effect);
      break;
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
