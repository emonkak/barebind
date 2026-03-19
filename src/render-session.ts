import { areDependenciesChanged } from './compare.js';
import {
  $hook,
  type ActionDispatcher,
  BOUNDARY_TYPE_ERROR,
  BOUNDARY_TYPE_SHARED_CONTEXT,
  type Cleanup,
  type Coroutine,
  DETACHED_SCOPE,
  type Effect,
  type EffectHandler,
  type EffectQueue,
  type ErrorHandler,
  HOOK_TYPE_FINALIZER,
  HOOK_TYPE_ID,
  HOOK_TYPE_INSERTION_EFFECT,
  HOOK_TYPE_LAYOUT_EFFECT,
  HOOK_TYPE_MEMO,
  HOOK_TYPE_PASSIVE_EFFECT,
  HOOK_TYPE_REDUCER,
  type Hook,
  type HookClass,
  type HookFunction,
  type HookObject,
  type InitialState,
  type NextState,
  type ReducerReturn,
  type RefObject,
  type RenderContext,
  type RenderFrame,
  type Scope,
  type SessionContext,
  type StateOptions,
  type StateReturn,
  type TemplateMode,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type Usable,
} from './core.js';
import { DirectiveSpecifier } from './directive.js';
import { AbortError, handleError, InterruptError } from './error.js';
import { getSchedulingLanes, NoLanes } from './lane.js';

const DETACHED_HOOKS = Object.freeze([] as Hook[]) as Hook[];

export class RenderSession implements RenderContext {
  private _hooks: Hook[];

  private _hookIndex = 0;

  private readonly _frame: RenderFrame;

  private _scope: Scope;

  private readonly _coroutine: Coroutine;

  private readonly _context: SessionContext;

  constructor(
    hooks: Hook[],
    frame: RenderFrame,
    scope: Scope,
    coroutine: Coroutine,
    context: SessionContext,
  ) {
    this._hooks = hooks;
    this._frame = frame;
    this._scope = scope;
    this._coroutine = coroutine;
    this._context = context;
  }

  catchError(handler: ErrorHandler): void {
    this._scope.boundary = {
      type: BOUNDARY_TYPE_ERROR,
      next: this._scope.boundary,
      handler,
    };
  }

  finalize(): void {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.FinalizerHook>(HOOK_TYPE_FINALIZER, currentHook);
    } else {
      currentHook = { type: HOOK_TYPE_FINALIZER };
    }

    this._hooks[this._hookIndex] = currentHook;

    // Refuse to use new hooks after finalization.
    Object.freeze(this._hooks);

    // Refuse to mutate scope after finalization.
    Object.freeze(this._scope);

    this._scope = DETACHED_SCOPE;
    this._hooks = DETACHED_HOOKS;
    this._hookIndex = 0;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (isDetachedScope(this._coroutine.scope)) {
      const skipped = Promise.resolve<UpdateResult>({ status: 'skipped' });
      return {
        id: -1,
        lanes: NoLanes,
        scheduled: skipped,
        finished: skipped,
      };
    }

    const renderLanes = this._frame.lanes;

    if (renderLanes !== NoLanes) {
      // We reuse the frame only for updates within the same lanes, which
      // avoids scheduling a new update during rendering. This is generally
      // undesirable, but necessary when an ErrorBoundary catches an error and
      // sets new state.
      const requestLanes = getSchedulingLanes(options ?? {});

      if ((renderLanes & requestLanes) === requestLanes) {
        for (const { id, controller } of this._context.getScheduledUpdates()) {
          if (id === this._frame.id) {
            this._frame.coroutines.push(this._coroutine);
            this._coroutine.pendingLanes |= renderLanes;
            return {
              id,
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
          boundary.type === BOUNDARY_TYPE_SHARED_CONTEXT &&
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

  interrupt(error: unknown): never {
    try {
      handleError(error, this._coroutine.scope);
    } catch (error) {
      throw new AbortError(
        this._coroutine,
        'No error boundary captured the error.',
        { cause: error },
      );
    }
    throw new InterruptError(
      this._coroutine,
      'The error was captured by an error boundary.',
      { cause: error },
    );
  }

  math(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): DirectiveSpecifier<readonly unknown[]> {
    return this._createTemplate(strings, values, 'math');
  }

  setSharedContext<T>(key: unknown, value: T): void {
    this._scope.boundary = {
      type: BOUNDARY_TYPE_SHARED_CONTEXT,
      next: this._scope.boundary,
      key,
      value,
    };
  }

  startTransition<T>(action: (transition: number) => T): T {
    return this._context.startTransition((transition) => {
      const result = action(transition);
      if (result instanceof Promise) {
        result.catch((error) => {
          this.interrupt(error);
        });
      }
      return result;
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
    setup: () => Cleanup | void,
    dependencies: readonly unknown[] | null = null,
  ): void {
    this._useEffectHook(
      setup,
      dependencies,
      HOOK_TYPE_PASSIVE_EFFECT,
      this._frame.passiveEffects,
    );
  }

  useId(): string {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.IdHook>(HOOK_TYPE_ID, currentHook);
    } else {
      currentHook = {
        type: HOOK_TYPE_ID,
        id: this._context.nextIdentifier(),
      };
    }

    this._hooks[this._hookIndex] = currentHook;
    this._hookIndex++;

    return currentHook.id;
  }

  useInsertionEffect(
    setup: () => Cleanup | void,
    dependencies: readonly unknown[] | null = null,
  ): void {
    this._useEffectHook(
      setup,
      dependencies,
      HOOK_TYPE_INSERTION_EFFECT,
      this._frame.mutationEffects,
    );
  }

  useLayoutEffect(
    setup: () => Cleanup | void,
    dependencies: readonly unknown[] | null = null,
  ): void {
    this._useEffectHook(
      setup,
      dependencies,
      HOOK_TYPE_LAYOUT_EFFECT,
      this._frame.layoutEffects,
    );
  }

  useMemo<TResult>(
    computation: () => TResult,
    dependencies: readonly unknown[],
  ): TResult {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.MemoHook<TResult>>(HOOK_TYPE_MEMO, currentHook);

      if (
        areDependenciesChanged(dependencies, currentHook.memoizedDependencies)
      ) {
        currentHook = {
          type: HOOK_TYPE_MEMO,
          memoizedResult: computation(),
          memoizedDependencies: dependencies,
        };
      }
    } else {
      currentHook = {
        type: HOOK_TYPE_MEMO,
        memoizedResult: computation(),
        memoizedDependencies: dependencies,
      };
    }

    this._hooks[this._hookIndex] = currentHook;
    this._hookIndex++;

    return currentHook.memoizedResult as TResult;
  }

  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
    options?: StateOptions,
  ): ReducerReturn<TState, TAction> {
    const { memoizedProposals, dispatcher } = this._useReducerHook(
      reducer,
      initialState,
      options,
    );
    return [
      dispatcher.pendingState,
      dispatcher.dispatch,
      memoizedProposals.length > 0,
    ];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => Object.seal({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
    options?: StateOptions,
  ): StateReturn<TState> {
    const { memoizedProposals, dispatcher } = this._useReducerHook<
      TState,
      NextState<TState>
    >(
      (state, action) =>
        typeof action === 'function'
          ? (action as (prevState: TState) => TState)(state)
          : action,
      initialState,
      options,
    );
    return [
      dispatcher.pendingState,
      dispatcher.dispatch,
      memoizedProposals.length > 0,
    ];
  }

  private _createTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveSpecifier<readonly unknown[]> {
    const template = this._context.resolveTemplate(strings, values, mode);
    return new DirectiveSpecifier(template, values);
  }

  private _useEffectHook(
    setup: () => Cleanup | void,
    dependencies: readonly unknown[] | null,
    type: Hook.EffectHook['type'],
    queue: EffectQueue,
  ): void {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.EffectHook>(type, currentHook);
      const { handler, memoizedDependencies } = currentHook;
      if (areDependenciesChanged(dependencies, memoizedDependencies)) {
        handler.epoch++;
        queue.push(new InvokeEffect(handler), this._scope.level);
        currentHook = {
          type,
          handler,
          memoizedDependencies: dependencies,
        };
      }
      handler.setup = setup;
    } else {
      const handler: EffectHandler = {
        setup,
        cleanup: undefined,
        epoch: 0,
      };
      currentHook = {
        type,
        handler,
        memoizedDependencies: dependencies,
      };
      queue.push(new InvokeEffect(handler), this._scope.level);
    }

    this._hooks[this._hookIndex] = currentHook;
    this._hookIndex++;
  }

  private _useReducerHook<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
    options: StateOptions = {},
  ): Hook.ReducerHook<TState, TAction> {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<Hook.ReducerHook<TState, TAction>>(
        HOOK_TYPE_REDUCER,
        currentHook,
      );

      const { dispatcher, memoizedState, memoizedProposals } = currentHook;
      const renderLanes = this._frame.lanes;
      let newState = options.passthrough
        ? getInitialState(initialState)
        : memoizedState;
      let skipLanes = NoLanes;

      memoizedProposals.push(...dispatcher.pendingProposals);

      for (const proposal of memoizedProposals) {
        const { action, lanes, revertLanes } = proposal;
        if ((lanes & renderLanes) === lanes) {
          newState = reducer(newState, action);
          proposal.lanes = NoLanes;
        } else if ((revertLanes & renderLanes) === revertLanes) {
          skipLanes |= lanes;
          proposal.revertLanes = NoLanes;
        }
      }

      if (skipLanes === NoLanes) {
        currentHook = {
          type: HOOK_TYPE_REDUCER,
          dispatcher,
          memoizedState: newState,
          memoizedProposals: [],
        };
      }

      dispatcher.context = this;
      dispatcher.pendingState = newState;
      dispatcher.pendingProposals = [];
      dispatcher.reducer = reducer;
    } else {
      const dispatcher: ActionDispatcher<TState, TAction> = {
        context: this,
        dispatch(action, options = {}) {
          const { context, pendingProposals, pendingState, reducer } = this;

          if (pendingProposals.length === 0) {
            const areStatesEqual = options.areStatesEqual ?? Object.is;
            const newState = reducer(pendingState, action);

            if (areStatesEqual(newState, pendingState)) {
              const skipped = Promise.resolve<UpdateResult>({
                status: 'skipped',
              });
              return {
                id: -1,
                lanes: NoLanes,
                scheduled: skipped,
                finished: skipped,
              };
            }
          }

          const handle = context.forceUpdate(options);
          pendingProposals.push({
            action,
            lanes: handle.lanes,
            revertLanes: options.transient ? handle.lanes : NoLanes,
          });
          return handle;
        },
        pendingProposals: [],
        pendingState: getInitialState(initialState),
        reducer,
      };
      dispatcher.dispatch = dispatcher.dispatch.bind(dispatcher);
      currentHook = {
        type: HOOK_TYPE_REDUCER,
        memoizedState: dispatcher.pendingState,
        memoizedProposals: [],
        dispatcher,
      };
    }

    this._hooks[this._hookIndex] = currentHook;
    this._hookIndex++;

    return currentHook;
  }
}

class InvokeEffect implements Effect {
  private readonly _handler: EffectHandler;

  private readonly _epoch: number;

  constructor(handler: EffectHandler) {
    this._handler = handler;
    this._epoch = handler.epoch;
  }

  commit(): void {
    const { cleanup, epoch, setup } = this._handler;

    if (epoch === this._epoch) {
      cleanup?.();
      this._handler.cleanup = setup();
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

function getInitialState<TState>(initialState: InitialState<TState>): TState {
  return typeof initialState === 'function'
    ? (initialState as () => TState)()
    : initialState;
}

function isDetachedScope(scope: Scope): boolean {
  let currentScope: Scope | undefined = scope;
  do {
    if (currentScope === DETACHED_SCOPE) {
      return true;
    }
    currentScope = currentScope.owner?.scope;
  } while (currentScope !== undefined);
  return false;
}
