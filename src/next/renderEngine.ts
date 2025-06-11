import { dependenciesAreChanged } from './compare.js';
import {
  type Bindable,
  type Coroutine,
  type DirectiveElement,
  type Effect,
  type RenderContext,
  type TemplateMode,
  type UpdateContext,
  createDirectiveElement,
} from './core.js';
import {
  type EffectHook,
  type FinalizerHook,
  type Hook,
  HookType,
  type IdentifierHook,
  type InitialState,
  Lane,
  type Lanes,
  type MemoHook,
  NO_LANES,
  type NewState,
  type ReducerHook,
  type RefObject,
  type UpdateOptions,
  type UpdateTask,
  type UseUserHooks,
  type UserHook,
  ensureHookType,
  userHookTag,
} from './hook.js';
import type { Literal } from './templateLiteral.js';

export class RenderEngine implements RenderContext {
  private readonly _hooks: Hook[];

  private readonly _lane: Lane;

  private readonly _coroutine: Coroutine;

  private readonly _updateContext: UpdateContext;

  private _hookIndex = 0;

  private _nextLanes = NO_LANES;

  constructor(
    hooks: Hook[],
    lane: Lane,
    coroutine: Coroutine,
    updateContext: UpdateContext,
  ) {
    this._hooks = hooks;
    this._lane = lane;
    this._coroutine = coroutine;
    this._updateContext = updateContext;
  }

  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: readonly (Bindable<unknown> | Literal)[]
  ): DirectiveElement<readonly Bindable<unknown>[]> {
    return this._dynamicTemplate(strings, binds, 'html');
  }

  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: readonly (Bindable<unknown> | Literal)[]
  ): DirectiveElement<readonly Bindable<unknown>[]> {
    return this._dynamicTemplate(strings, binds, 'math');
  }

  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: readonly (Bindable<unknown> | Literal)[]
  ): DirectiveElement<readonly Bindable<unknown>[]> {
    return this._dynamicTemplate(strings, binds, 'svg');
  }

  getContextualValue<T>(key: unknown): T | undefined {
    return this._updateContext.getContextualValue(key);
  }

  finalize(): Lanes {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<FinalizerHook>(HookType.Finalizer, currentHook);
    } else {
      this._hooks.push({ type: HookType.Finalizer });

      // Refuse to use new hooks after finalization.
      Object.freeze(this._hooks);
    }

    this._hookIndex++;

    return this._nextLanes;
  }

  forceUpdate(options?: UpdateOptions): UpdateTask {
    return this._updateContext.scheduleUpdate(this._coroutine, options);
  }

  html(
    strings: TemplateStringsArray,
    ...binds: readonly Bindable<unknown>[]
  ): DirectiveElement<readonly Bindable<unknown>[]> {
    return this._template(strings, binds, 'html');
  }

  math(
    strings: TemplateStringsArray,
    ...binds: readonly Bindable<unknown>[]
  ): DirectiveElement<readonly Bindable<unknown>[]> {
    return this._template(strings, binds, 'math');
  }

  setContextualValue<T>(key: unknown, value: T): void {
    return this._updateContext.setContextualValue(key, value);
  }

  svg(
    strings: TemplateStringsArray,
    ...binds: readonly Bindable<unknown>[]
  ): DirectiveElement<readonly Bindable<unknown>[]> {
    return this._template(strings, binds, 'svg');
  }

  use<T>(hook: UserHook<T>): T;
  use<THooks extends readonly UserHook<unknown>[]>(
    hooks: THooks,
  ): UseUserHooks<THooks>;
  use<T>(hook: UserHook<T> | UserHook<T>[]): T | T[] {
    return Array.isArray(hook)
      ? hook.map((hook) => hook[userHookTag](this))
      : hook[userHookTag](this);
  }

  useCallback<TCallback extends Function>(
    callback: TCallback,
    dependencies: unknown[],
  ): TCallback {
    return this.useMemo(() => callback, dependencies);
  }

  useDeferredValue<TValue>(
    value: TValue,
    initialValue?: InitialState<TValue>,
  ): TValue {
    const [deferredValue, setDeferredValue] = this.useReducer<TValue, TValue>(
      (_state, action) => action,
      initialValue ?? (() => value),
    );

    this.useEffect(() => {
      setDeferredValue(value, { priority: 'background' });
    }, [value]);

    return deferredValue;
  }

  useEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null = null,
  ): void {
    return this._useEffect(callback, dependencies, HookType.PassiveEffect);
  }

  useId(): string {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<IdentifierHook>(HookType.Identifier, currentHook);
    } else {
      currentHook = {
        type: HookType.Identifier,
        id: this._updateContext.nextIdentifier(),
      };
      this._hooks.push(currentHook);
    }

    this._hookIndex++;

    return currentHook.id;
  }

  useInsertionEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null = null,
  ): void {
    return this._useEffect(callback, dependencies, HookType.InsertionEffect);
  }

  useLayoutEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null = null,
  ): void {
    return this._useEffect(callback, dependencies, HookType.LayoutEffect);
  }

  useMemo<TResult>(factory: () => TResult, dependencies: unknown[]): TResult {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<MemoHook<TResult>>(HookType.Memo, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
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

    return currentHook.value as TResult;
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
      ensureHookType<ReducerHook<TState, TAction>>(
        HookType.Reducer,
        currentHook,
      );
      if ((currentHook.lanes & this._lane) !== NO_LANES) {
        currentHook.lanes = NO_LANES;
        currentHook.reducer = reducer;
        currentHook.memoizedState = currentHook.pendingState;
      } else {
        this._nextLanes |= currentHook.lanes;
      }
    } else {
      const state =
        typeof initialState === 'function' ? initialState() : initialState;
      const hook: ReducerHook<TState, TAction> = {
        type: HookType.Reducer,
        lanes: NO_LANES,
        reducer,
        pendingState: state,
        memoizedState: state,
        dispatch: (action: TAction, options?: UpdateOptions) => {
          const oldState = hook.memoizedState;
          const newState = hook.reducer(oldState, action);

          if (!Object.is(oldState, newState)) {
            const { priority } = this.forceUpdate(options);
            hook.pendingState = newState;
            hook.lanes |= Lane[priority];
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
      currentHook.lanes !== NO_LANES,
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

  useSyncEnternalStore<T>(
    subscribe: (subscruber: () => void) => VoidFunction | void,
    getSnapshot: () => T,
    options?: UpdateOptions,
  ): T {
    this.useEffect(
      () =>
        subscribe(() => {
          this.forceUpdate(options);
        }),
      [subscribe],
    );
    return getSnapshot();
  }

  private _dynamicTemplate(
    strings: TemplateStringsArray,
    binds: readonly (Bindable<unknown> | Literal)[],
    mode: TemplateMode,
  ): DirectiveElement<readonly Bindable<unknown>[]> {
    const { strings: expandedStrings, values: expandedBinds } =
      this._updateContext.expandLiterals(strings, binds);
    const template = this._updateContext.getTemplate(
      expandedStrings,
      expandedBinds as Bindable<unknown>[],
      mode,
    );
    return createDirectiveElement(template, expandedBinds);
  }

  private _template(
    strings: TemplateStringsArray,
    binds: readonly Bindable<unknown>[],
    mode: TemplateMode,
  ): DirectiveElement<readonly Bindable<unknown>[]> {
    const template = this._updateContext.getTemplate(strings, binds, mode);
    return createDirectiveElement(template, binds);
  }

  private _useEffect(
    callback: () => VoidFunction | void,
    dependencies: unknown[] | null,
    type: EffectHook['type'],
  ): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(type, currentHook);
      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updateContext.enqueuePassiveEffect(
          new InvokeEffectHook(currentHook),
        );
      }
      currentHook.callback = callback;
      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type,
        callback,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updateContext.enqueuePassiveEffect(new InvokeEffectHook(hook));
    }

    this._hookIndex++;
  }
}

class InvokeEffectHook implements Effect {
  private readonly _hook: EffectHook;

  constructor(hook: EffectHook) {
    this._hook = hook;
  }

  commit(): void {
    const { cleanup, callback } = this._hook;
    cleanup?.();
    this._hook.cleanup = callback();
  }
}
