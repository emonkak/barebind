import { areDependenciesChanged } from './compare.js';
import {
  BOUNDARY_TYPE_ERROR,
  BOUNDARY_TYPE_SHARED_CONTEXT,
  type Coroutine,
  type Directive,
  type DirectiveType,
  type Effect,
  type EffectQueue,
  type ErrorHandler,
  type Lanes,
  type RenderFrame,
  Scope,
  type SessionContext,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
} from './core.js';
import { AbortError, handleError, InterruptError } from './error.js';
import { getSchedulingLanes, NoLanes } from './lane.js';

export const $hook: unique symbol = Symbol('$hook');

export const HOOK_TYPE_FINALIZER = 0;
export const HOOK_TYPE_PASSIVE_EFFECT = 1;
export const HOOK_TYPE_LAYOUT_EFFECT = 2;
export const HOOK_TYPE_INSERTION_EFFECT = 3;
export const HOOK_TYPE_ID = 4;
export const HOOK_TYPE_MEMO = 5;
export const HOOK_TYPE_REDUCER = 6;

const DETACHED_HOOKS = Object.freeze([] as Hook[]) as Hook[];

export interface ActionDispatcher<TState, TAction> {
  context: RenderContext;
  dispatch: (
    action: TAction,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle;
  pendingProposals: ActionProposal<TAction>[];
  pendingState: TState;
  reducer: (state: TState, action: TAction) => TState;
}

export interface ActionProposal<TAction> {
  action: TAction;
  lanes: Lanes;
  revertLanes: Lanes;
}

export type Cleanup = () => void;

export interface Component<TProps = {}, TResult = unknown>
  extends DirectiveType<TProps> {
  (props: TProps): Directive.Element<TProps>;
  render(props: TProps, context: RenderContext): TResult;
  arePropsEqual(nextProps: TProps, prevProps: TProps): boolean;
}

export interface DispatchOptions<TState> extends UpdateOptions {
  areStatesEqual?: (nextState: TState, prevState: TState) => boolean;
  transient?: boolean;
}

export interface EffectHandler {
  setup: (() => Cleanup | void) | null;
  cleanup: Cleanup | void;
}

export type Hook =
  | Hook.FinalizerHook
  | Hook.EffectHook
  | Hook.IdHook
  | Hook.MemoHook<any>
  | Hook.ReducerHook<any, any>;

export namespace Hook {
  export interface FinalizerHook {
    type: typeof HOOK_TYPE_FINALIZER;
  }

  export interface EffectHook {
    type:
      | typeof HOOK_TYPE_PASSIVE_EFFECT
      | typeof HOOK_TYPE_LAYOUT_EFFECT
      | typeof HOOK_TYPE_INSERTION_EFFECT;
    handler: EffectHandler;
    memoizedDependencies: readonly unknown[] | null;
  }

  export interface IdHook {
    type: typeof HOOK_TYPE_ID;
    id: string;
  }

  export interface MemoHook<TResult> {
    type: typeof HOOK_TYPE_MEMO;
    memoizedResult: TResult;
    memoizedDependencies: readonly unknown[] | null;
  }

  export interface ReducerHook<TState, TAction> {
    type: typeof HOOK_TYPE_REDUCER;
    dispatcher: ActionDispatcher<TState, TAction>;
    memoizedState: TState;
    memoizedProposals: ActionProposal<TAction>[];
  }
}

/**
 * Represents a class with static [$hook] method. never[] and NoInfer<T> ensure
 * T is inferred solely from the constructor.
 */
export interface HookClass<T> {
  new (...args: never[]): T;
  [$hook](context: RenderContext): NoInfer<T>;
}

export type HookFunction<T> = (context: RenderContext) => T;

export interface HookObject<T> {
  [$hook](context: RenderContext): T;
}

export type InitialState<T> = (T extends Function ? never : T) | (() => T);

export type NextState<T> = (T extends Function ? never : T) | ((state: T) => T);

export type Ref<T> = RefCallback<T> | RefObject<T | null> | null | undefined;

export type RefCallback<T> = (value: T) => Cleanup | void;

export interface RefObject<T> {
  current: T;
}

export type ReducerReturn<TState, TAction> = [
  state: TState,
  dispatch: (
    action: TAction,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle,
  isStale: boolean,
];

export interface StateOptions {
  passthrough?: boolean;
}

export type StateReturn<TState> = [
  state: TState,
  setState: (
    nextState: NextState<TState>,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle,
  isStale: boolean,
];

export type Usable<T> = HookClass<T> | HookObject<T> | HookFunction<T>;

export class RenderContext {
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

    this._scope = Scope.Orphan;
    this._hooks = DETACHED_HOOKS;
    this._hookIndex = 0;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (this._coroutine.scope.isOrphan()) {
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
      if (!currentScope.isChild()) {
        break;
      }
      currentScope = currentScope.owner.scope;
    }
    return undefined;
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

  constructor(handler: EffectHandler) {
    this._handler = handler;
  }

  commit(): void {
    const { cleanup, setup } = this._handler;
    cleanup?.();
    this._handler.setup = null;
    this._handler.cleanup = setup?.();
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
