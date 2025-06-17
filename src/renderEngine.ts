import { dependenciesAreChanged } from './compare.js';
import {
  type BindableObject,
  type Coroutine,
  DirectiveObject,
  type Effect,
  type RenderContext,
  type TemplateMode,
  type UpdateContext,
} from './directive.js';
import {
  $customHook,
  CommitPhase,
  type CustomHook,
  type EffectHook,
  ensureHookType,
  type FinalizerHook,
  getLanesFromPriority,
  type Hook,
  HookType,
  type IdentifierHook,
  type InitialState,
  type Lanes,
  type MemoHook,
  type NewState,
  NO_LANES,
  type ReducerHook,
  type RefObject,
  type UpdateOptions,
  type UpdateTask,
  type UseCustomHooks,
} from './hook.js';

export class RenderEngine implements RenderContext {
  private readonly _hooks: Hook[];

  private readonly _lanes: Lanes;

  private readonly _coroutine: Coroutine;

  private readonly _updateContext: UpdateContext;

  private _hookIndex = 0;

  private _nextLanes = NO_LANES;

  constructor(
    hooks: Hook[],
    lanes: Lanes,
    coroutine: Coroutine,
    updateContext: UpdateContext,
  ) {
    this._hooks = hooks;
    this._lanes = lanes;
    this._coroutine = coroutine;
    this._updateContext = updateContext;
  }

  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): BindableObject<readonly unknown[]> {
    return this._dynamicTemplate(strings, binds, 'html');
  }

  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): BindableObject<readonly unknown[]> {
    return this._dynamicTemplate(strings, binds, 'math');
  }

  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): BindableObject<readonly unknown[]> {
    return this._dynamicTemplate(strings, binds, 'svg');
  }

  getContextValue(key: unknown): unknown {
    return this._updateContext.getContextValue(key);
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
    return this._updateContext
      .createSubcontext()
      .scheduleUpdate(this._coroutine, options);
  }

  html(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): BindableObject<readonly unknown[]> {
    return this._template(strings, binds, 'html');
  }

  math(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): BindableObject<readonly unknown[]> {
    return this._template(strings, binds, 'math');
  }

  setContextValue(key: unknown, value: unknown): void {
    this._updateContext.setContextValue(key, value);
  }

  svg(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): BindableObject<readonly unknown[]> {
    return this._template(strings, binds, 'svg');
  }

  use<T>(hook: CustomHook<T>): T;
  use<THooks extends readonly CustomHook<unknown>[]>(
    hooks: THooks,
  ): UseCustomHooks<THooks>;
  use<T>(hook: CustomHook<T> | CustomHook<T>[]): T | T[] {
    return Array.isArray(hook)
      ? hook.map((hook) => hook[$customHook](this))
      : hook[$customHook](this);
  }

  useCallback<T extends Function>(callback: T, dependencies: unknown[]): T {
    return this.useMemo(() => callback, dependencies);
  }

  useDeferredValue<T>(value: T, initialValue?: InitialState<T>): T {
    const [deferredValue, setDeferredValue] = this.useReducer<T, T>(
      (_state, action) => action,
      initialValue ?? (() => value),
    );

    this.useLayoutEffect(() => {
      setDeferredValue(value, { priority: 'background' });
    }, [value]);

    return deferredValue;
  }

  useEffect(
    callback: () => (() => void) | void,
    dependencies: unknown[] | null = null,
  ): void {
    this._useEffect(callback, dependencies, CommitPhase.Passive);
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
    callback: () => (() => void) | void,
    dependencies: unknown[] | null = null,
  ): void {
    this._useEffect(callback, dependencies, CommitPhase.Mutation);
  }

  useLayoutEffect(
    callback: () => (() => void) | void,
    dependencies: unknown[] | null = null,
  ): void {
    this._useEffect(callback, dependencies, CommitPhase.Layout);
  }

  useMemo<T>(factory: () => T, dependencies: unknown[]): T {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<MemoHook<T>>(HookType.Memo, currentHook);

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
      ensureHookType<ReducerHook<TState, TAction>>(
        HookType.Reducer,
        currentHook,
      );
      if ((currentHook.lanes & this._lanes) !== NO_LANES) {
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
            hook.lanes |= getLanesFromPriority(priority);
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

  useSyncEnternalStore<TSnapshot>(
    subscribe: (subscruber: () => void) => (() => void) | void,
    getSnapshot: () => TSnapshot,
    options?: UpdateOptions,
  ): TSnapshot {
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
    binds: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveObject<readonly unknown[]> {
    const { strings: expandedStrings, values: expandedBinds } =
      this._updateContext.expandLiterals(strings, binds);
    const template = this._updateContext.getTemplate(
      expandedStrings,
      expandedBinds as unknown[],
      mode,
    );
    return new DirectiveObject(template, expandedBinds);
  }

  private _template(
    strings: TemplateStringsArray,
    binds: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveObject<readonly unknown[]> {
    const template = this._updateContext.getTemplate(strings, binds, mode);
    return new DirectiveObject(template, binds);
  }

  private _useEffect(
    callback: () => (() => void) | void,
    dependencies: unknown[] | null,
    phase: CommitPhase,
  ): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.Effect, currentHook);
      currentHook.phase = phase;
      currentHook.callback = callback;
      currentHook.dependencies = dependencies;
      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        enqueueEffectHook(currentHook, this._updateContext);
      }
    } else {
      const hook: EffectHook = {
        type: HookType.Effect,
        phase,
        callback,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      enqueueEffectHook(hook, this._updateContext);
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

function enqueueEffectHook(hook: EffectHook, context: UpdateContext): void {
  switch (hook.phase) {
    case CommitPhase.Mutation:
      context.enqueueMutationEffect(new InvokeEffectHook(hook));
      break;
    case CommitPhase.Layout:
      context.enqueueLayoutEffect(new InvokeEffectHook(hook));
      break;
    case CommitPhase.Passive:
      context.enqueuePassiveEffect(new InvokeEffectHook(hook));
      break;
  }
}
