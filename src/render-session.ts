import { areDependenciesChanged } from './compare.js';
import {
  $hook,
  type ActionDispatcher,
  BoundaryType,
  type Cleanup,
  type ComponentState,
  type Coroutine,
  DETACHED_SCOPE,
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
  type ReducerReturn,
  type RefObject,
  type RenderContext,
  type RenderFrame,
  type Scope,
  type SessionContext,
  type StateReturn,
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
import { InvokeEffectHook } from './hook.js';

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
        id: -1,
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
    this._useEffect(
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
    this._useEffect(
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
    this._useEffect(
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
  ): ReducerReturn<TState, TAction> {
    const { hooks } = this._state;
    let currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.ReducerHook<TState, TAction>>(
        HookType.Reducer,
        currentHook,
      );

      const { dispatcher, memoizedState } = currentHook;
      const renderLanes = this._frame.lanes;
      let newState = memoizedState;
      let pendingLanes = Lane.NoLane;

      for (const proposal of dispatcher.pendingProposals) {
        const { action, lanes } = proposal;
        if ((lanes & renderLanes) === lanes) {
          newState = reducer(newState, action);
          proposal.lanes = Lane.NoLane;
        } else {
          pendingLanes |= lanes;
        }
      }

      if (pendingLanes === Lane.NoLane) {
        dispatcher.pendingProposals = [];
        currentHook.memoizedState = newState;
      }

      dispatcher.context = this;
      dispatcher.pendingState = newState;
      dispatcher.reducer = reducer;
    } else {
      const dispatcher: ActionDispatcher<TState, TAction> = {
        context: this,
        dispatch(action, options = {}) {
          const { context, pendingProposals, pendingState, reducer } = this;
          const areStatesEqual = options.areStatesEqual ?? Object.is;
          const nextState = reducer(pendingState, action);

          if (
            pendingProposals.length === 0 &&
            areStatesEqual(nextState, pendingState)
          ) {
            const skipped = Promise.resolve<UpdateResult>({
              status: 'skipped',
            });
            return {
              id: -1,
              lanes: Lane.NoLane,
              scheduled: skipped,
              finished: skipped,
            };
          } else {
            const handle = context.forceUpdate(options);
            pendingProposals.push({
              action,
              lanes: handle.lanes,
            });
            return handle;
          }
        },
        pendingProposals: [],
        pendingState:
          typeof initialState === 'function'
            ? (initialState as () => TState)()
            : initialState,
        reducer,
      };
      dispatcher.dispatch = dispatcher.dispatch.bind(dispatcher);
      currentHook = {
        type: HookType.Reducer,
        memoizedState: dispatcher.pendingState,
        dispatcher,
      };
      hooks.push(currentHook);
    }

    this._hookIndex++;

    const { pendingState, dispatch, pendingProposals } = currentHook.dispatcher;
    return [pendingState, dispatch, pendingProposals.length > 0];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => Object.seal({ current: initialValue }), []);
  }

  useState<TState>(initialState: InitialState<TState>): StateReturn<TState> {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function'
          ? (action as (prevState: TState) => TState)(state)
          : action,
      initialState,
    );
  }

  private _createTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveSpecifier<readonly unknown[]> {
    const template = this._context.resolveTemplate(strings, values, mode);
    return new DirectiveSpecifier(template, values);
  }

  private _useEffect(
    callback: () => Cleanup | void,
    dependencies: readonly unknown[] | null,
    type: Hook.EffectHook['type'],
    queue: EffectQueue,
  ): void {
    const { hooks } = this._state;
    let currentHook = hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.EffectHook>(type, currentHook);
      if (
        areDependenciesChanged(dependencies, currentHook.memoizedDependencies)
      ) {
        currentHook.epoch++;
        queue.push(new InvokeEffectHook(currentHook), this._scope.level);
      }
      currentHook.callback = callback;
      currentHook.pendingDependencies = dependencies;
    } else {
      currentHook = {
        type,
        callback,
        cleanup: undefined,
        epoch: 0,
        pendingDependencies: dependencies,
        memoizedDependencies: null,
      };
      hooks.push(currentHook);
      queue.push(new InvokeEffectHook(currentHook), this._scope.level);
    }

    this._hookIndex++;
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
