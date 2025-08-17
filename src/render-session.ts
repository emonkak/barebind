import { sequentialEqual } from './compare.js';
import { DirectiveSpecifier } from './directive.js';
import {
  $customHook,
  type Cleanup,
  type Coroutine,
  type Effect,
  type Hook,
  HookType,
  type InitialState,
  Lanes,
  type NewState,
  type RefObject,
  type RenderContext,
  type RenderSessionContext,
  type TemplateMode,
  type UpdateHandle,
  type UpdateOptions,
  type Usable,
} from './internal.js';

export class RenderSession implements RenderContext {
  private readonly _hooks: Hook[];

  private readonly _flushLanes: Lanes;

  private readonly _coroutine: Coroutine;

  private readonly _context: RenderSessionContext;

  private _hookIndex = 0;

  private _pendingLanes = Lanes.NoLanes;

  constructor(
    hooks: Hook[],
    flushLanes: Lanes,
    coroutine: Coroutine,
    runtime: RenderSessionContext,
  ) {
    this._hooks = hooks;
    this._flushLanes = flushLanes;
    this._coroutine = coroutine;
    this._context = runtime;
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

  getContextValue(key: unknown): unknown {
    return this._context.getCurrentScope().get(key);
  }

  finalize(): Lanes {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.FinalizerHook>(HookType.Finalizer, currentHook);
    } else {
      this._hooks.push({ type: HookType.Finalizer });

      // Refuse to use new hooks after finalization.
      Object.freeze(this._hooks);
    }

    this._hookIndex++;

    return this._pendingLanes;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    return this._context.scheduleUpdate(this._coroutine, options);
  }

  html(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._template(strings, binds, 'html');
  }

  isUpdatePending(): boolean {
    const updateHandles = this._context.getUpdateHandles();

    for (let node = updateHandles.front(); node !== null; node = node.next) {
      if (node.value.coroutine === this._coroutine) {
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

  setContextValue(key: unknown, value: unknown): void {
    this._context.getCurrentScope().set(key, value);
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
        id: this._context.nextIdentifier(),
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
    dispatch: (action: TAction, options?: UpdateOptions) => void,
    isPending: boolean,
  ] {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.ReducerHook<TState, TAction>>(
        HookType.Reducer,
        currentHook,
      );
      if ((currentHook.lanes & this._flushLanes) === currentHook.lanes) {
        currentHook.lanes = Lanes.NoLanes;
        currentHook.reducer = reducer;
        currentHook.memoizedState = currentHook.pendingState;
      } else {
        this._pendingLanes |= currentHook.lanes;
      }
    } else {
      const state =
        typeof initialState === 'function' ? initialState() : initialState;
      const hook: Hook.ReducerHook<TState, TAction> = {
        type: HookType.Reducer,
        lanes: Lanes.NoLanes,
        reducer,
        pendingState: state,
        memoizedState: state,
        dispatch: (action: TAction, options?: UpdateOptions) => {
          const prevState = hook.memoizedState;
          const nextState = hook.reducer(prevState, action);

          if (!Object.is(nextState, prevState)) {
            const { lanes } = this.forceUpdate(options);
            hook.pendingState = nextState;
            hook.lanes |= lanes;
          }
        },
      };
      currentHook = hook;
      this._hooks.push(hook);
    }

    this._hookIndex++;

    return [
      currentHook.memoizedState,
      currentHook.dispatch,
      currentHook.lanes !== Lanes.NoLanes,
    ];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => Object.seal({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
  ): [
    state: TState,
    setState: (newState: NewState<TState>, options?: UpdateOptions) => void,
    isPending: boolean,
  ] {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function' ? action(state) : action,
      initialState,
    );
  }

  async waitForUpdate(): Promise<number> {
    const updateHandles = this._context.getUpdateHandles();
    const promises: Promise<void>[] = [];

    for (let node = updateHandles.front(); node !== null; node = node.next) {
      if (node.value.coroutine === this._coroutine) {
        promises.push(node.value.promise);
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

  private _useEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null,
    type: Hook.EffectHook['type'],
  ): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.EffectHook>(type, currentHook);
      if (areDependenciesChanged(dependencies, currentHook.dependencies)) {
        enqueueEffect(currentHook, this._context);
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
      enqueueEffect(hook, this._context);
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

function enqueueEffect(
  hook: Hook.EffectHook,
  context: RenderSessionContext,
): void {
  const effect = new InvokeEffectHook(hook);
  switch (hook.type) {
    case HookType.Effect:
      context.enqueuePassiveEffect(effect);
      break;
    case HookType.LayoutEffect:
      context.enqueueLayoutEffect(effect);
      break;
    case HookType.InsertionEffect:
      context.enqueueMutationEffect(effect);
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
