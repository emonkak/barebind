import { areDependenciesChanged } from '../compare.js';
import {
  type Component,
  Directive,
  type DirectiveHandler,
  type Effect,
  ErrorBoundary,
  type ErrorHandler,
  type Lanes,
  NoLanes,
  Scope,
  type Session,
  SharedContextBoundary,
  Slot,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  wrap,
} from '../core.js';
import { AbortError, handleError } from '../error.js';

const FinalizerType = 0;
const PassiveEffectType = 1;
const LayoutEffectType = 2;
const InsertionEffectType = 3;
const IdType = 4;
const MemoType = 5;
const ReducerType = 6;

export interface FunctionComponentOptions<TProps> {
  arePropsEqual?: (newProps: TProps, oldProps: TProps) => boolean;
}

export type FunctionComponent<TProps, TReturn> = (
  this: FunctionComponentContext,
  props: TProps,
) => TReturn;

interface Action<TPayload> {
  payload: TPayload;
  lanes: Lanes;
  revertLanes: Lanes;
}

interface ActionDispatcher<TState, TPayload> {
  dispatch: (
    payload: TPayload,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle;
  pendingActions: Action<TPayload>[];
  pendingState: TState;
  reducer: (state: TState, action: TPayload) => TState;
}

type Cleanup = () => void;

interface DispatchOptions<TState> extends UpdateOptions {
  areStatesEqual?: (nextState: TState, prevState: TState) => boolean;
  transient?: boolean;
}

type Hook =
  | Hook.FinalizerHook
  | Hook.EffectHook
  | Hook.IdHook
  | Hook.MemoHook<any>
  | Hook.ReducerHook<any, any>;

namespace Hook {
  export interface FinalizerHook {
    type: typeof FinalizerType;
  }

  export interface EffectHook {
    type:
      | typeof PassiveEffectType
      | typeof LayoutEffectType
      | typeof InsertionEffectType;
    setup: (() => Cleanup | void) | null;
    cleanup: Cleanup | void;
    pendingDependencies: readonly unknown[] | null;
    memoizedDependencies: readonly unknown[] | null;
  }

  export interface IdHook {
    type: typeof IdType;
    id: string;
  }

  export interface MemoHook<TResult> {
    type: typeof MemoType;
    memoizedResult: TResult;
    memoizedDependencies: readonly unknown[] | null;
  }

  export interface ReducerHook<TState, TAction> {
    type: typeof ReducerType;
    dispatcher: ActionDispatcher<TState, TAction>;
    memoizedActions: Action<TAction>[];
    memoizedState: TState;
  }
}

/**
 * Represents a class with static [$hook] method. never[] and NoInfer<T> ensure
 * T is inferred solely from the constructor.
 */
interface HookClass<T> {
  new (...args: never[]): T;
  onUse(context: FunctionComponentContext): NoInfer<T>;
}

type HookFunction<T> = (context: FunctionComponentContext) => T;

interface HookObject<T> {
  onUse(context: FunctionComponentContext): T;
}

type InitialState<T> = (T extends Function ? never : T) | (() => T);

type NextState<T> = (T extends Function ? never : T) | ((state: T) => T);

interface RefObject<T> {
  current: T;
}

type ReducerReturn<TState, TAction> = [
  state: TState,
  dispatch: (
    action: TAction,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle,
];

interface StateOptions {
  passthrough?: boolean;
}

type StateReturn<TState> = [
  state: TState,
  setState: (
    nextState: NextState<TState>,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle,
];

type Usable<T> = HookClass<T> | HookObject<T> | HookFunction<T>;

export class FunctionComponentHandler<TProps, TReturn, TPart>
  implements DirectiveHandler<TProps, TPart>
{
  private readonly _componentFn: FunctionComponent<TProps, TReturn>;

  private readonly _arePropsEqual: (
    newProps: TProps,
    oldProps: TProps,
  ) => boolean;

  private _context: FunctionComponentContext | null = null;

  private _slot: Slot<TPart> | null = null;

  private _currentHooks: Hook[] = [];

  constructor(
    componentFn: FunctionComponent<TProps, TReturn>,
    arePropsEqual: (newProps: TProps, oldProps: TProps) => boolean,
  ) {
    this._componentFn = componentFn;
    this._arePropsEqual = arePropsEqual;
  }

  shouldUpdate(newProps: TProps, oldProps: TProps): boolean {
    const arePropsEqual = this._arePropsEqual;
    return !arePropsEqual(newProps, oldProps);
  }

  render(
    props: TProps,
    part: TPart,
    scope: Scope.ChildScope<TPart>,
    session: Session<TPart>,
  ): Iterable<Slot<TPart>> {
    if (this._context !== null) {
      const hooks =
        scope.owner === this._context._scope.owner
          ? this._context._hooks
          : this._currentHooks;
      resetContext(this._context, hooks, scope, session);
    } else {
      this._context = new FunctionComponentContext(scope, session);
    }

    const returnValue = this._componentFn.call(this._context, props);
    const directive = wrap(returnValue);

    finalizeContext(this._context);

    this._slot =
      this._slot?.update(directive, scope) ?? new Slot(part, directive, scope);

    return [this._slot];
  }

  complete(
    _props: TProps,
    _part: TPart,
    scope: Scope<TPart>,
    session: Session<TPart>,
  ): void {
    if (this._context !== null) {
      completeContext(this._context, scope, session);
    }
  }

  discard(
    _props: TProps,
    _part: TPart,
    scope: Scope<TPart>,
    session: Session<TPart>,
  ): void {
    if (this._context !== null) {
      discardContext(this._context, scope, session);
    }
    this._slot?.discard(session);
  }

  commit(_newValue: TProps, _oldValue: TProps | null, _part: TPart): void {
    this._slot?.commit();
    if (this._context !== null) {
      this._currentHooks = this._context?._hooks;
    }
  }

  revert(_value: TProps, _part: TPart): void {
    this._slot?.revert();
    this._currentHooks = [];
  }
}

export class FunctionComponentContext {
  /** @internal */
  _scope: Scope;
  /** @internal */
  _session: Session;
  /** @internal */
  _hooks: Hook[] = [];
  /** @internal */
  _hookIndex = 0;

  constructor(scope: Scope, session: Session) {
    this._scope = scope;
    this._session = session;
  }

  catchError(handler: ErrorHandler): void {
    this._scope.boundary = {
      type: ErrorBoundary,
      next: this._scope.boundary,
      handler,
    };
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (!this._scope.isChild()) {
      const skipped: Promise<UpdateResult> = Promise.resolve({
        status: 'skipped',
      });
      return {
        id: -1,
        lanes: NoLanes,
        scheduled: skipped,
        finished: skipped,
      };
    }
    if (!Object.isFrozen(this._scope)) {
      for (const update of this._session.scheduler.updateQueue) {
        if (update.id === this._session.id) {
          this._scope.owner.pendingLanes |= update.lanes;
          return {
            id: update.id,
            lanes: update.lanes,
            scheduled: Promise.resolve({ status: 'done' }),
            finished: update.controller.promise,
          };
        }
      }
    }
    const handle = this._session.scheduler.schedule(this._scope.owner, options);
    this._scope.owner.pendingLanes |= handle.lanes;
    return handle;
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
          boundary.type === SharedContextBoundary &&
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

  throwError(error: unknown): void {
    try {
      handleError(this._scope, error);
    } catch (error) {
      throw new AbortError(
        this._scope,
        'No error boundary captured the error.',
        { cause: error },
      );
    }
  }

  setSharedContext<T>(key: unknown, value: T): void {
    this._scope.boundary = {
      type: SharedContextBoundary,
      next: this._scope.boundary,
      key,
      value,
    };
  }

  startTransition<T>(action: (transition: number) => T): T {
    const transition = this._session.scheduler.nextTransition();
    const result = action(transition);
    if (result instanceof Promise) {
      result.catch((error) => {
        this.throwError(error);
      });
    }
    return result;
  }

  use<T>(usable: HookClass<T>): T;
  use<T>(usable: HookObject<T>): T;
  use<T>(usable: HookFunction<T>): T;
  use<T>(usable: Usable<T>): T {
    if ('onUse' in usable) {
      return usable.onUse(this);
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
    createEffectHook(this, setup, dependencies, PassiveEffectType);
  }

  useId(): string {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType(IdType, currentHook);
    } else {
      const root = this._scope.getRoot();
      const id =
        root !== null ? root.owner.idPrefix + '-' + root.owner.idSeq++ : '';
      currentHook = {
        type: IdType,
        id,
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
    createEffectHook(this, setup, dependencies, InsertionEffectType);
  }

  useLayoutEffect(
    setup: () => Cleanup | void,
    dependencies: readonly unknown[] | null = null,
  ): void {
    createEffectHook(this, setup, dependencies, LayoutEffectType);
  }

  useMemo<TResult>(
    computation: () => TResult,
    dependencies: readonly unknown[],
  ): TResult {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType(MemoType, currentHook);

      if (
        areDependenciesChanged(dependencies, currentHook.memoizedDependencies)
      ) {
        currentHook = {
          type: MemoType,
          memoizedResult: computation(),
          memoizedDependencies: dependencies,
        };
      }
    } else {
      currentHook = {
        type: MemoType,
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
    const { dispatcher } = createReducerHook(
      this,
      reducer,
      initialState,
      options,
    );
    return [dispatcher.pendingState, dispatcher.dispatch];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => Object.seal({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
    options?: StateOptions,
  ): StateReturn<TState> {
    const { dispatcher } = createReducerHook<TState, NextState<TState>>(
      this,
      (state, action) =>
        typeof action === 'function'
          ? (action as (prevState: TState) => TState)(state)
          : action,
      initialState,
      options,
    );
    return [dispatcher.pendingState, dispatcher.dispatch];
  }
}

export function createFunctionComponent<TProps = {}, TReturn = unknown>(
  componentFn: FunctionComponent<TProps, TReturn>,
  { arePropsEqual = Object.is }: FunctionComponentOptions<TProps> = {},
): Component<TProps> {
  function Component(props: TProps): Directive.ComponentDirective<TProps> {
    return new Directive(Component, props);
  }

  Component.resolveComponent = (
    _directive: Directive.ComponentDirective<TProps>,
  ): DirectiveHandler<TProps> =>
    new FunctionComponentHandler(componentFn, arePropsEqual);

  DEBUG: {
    Object.defineProperty(Component, 'name', {
      value: componentFn.name,
    });
  }

  return Component;
}

class CleanupEffect implements Effect {
  private readonly _hook: Hook.EffectHook;
  private readonly _scope: Scope;

  constructor(hook: Hook.EffectHook, scope: Scope) {
    this._hook = hook;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  commit(): void {
    const { cleanup } = this._hook;
    cleanup?.();
    this._hook.cleanup = undefined;
  }
}

class InvokeEffect implements Effect {
  private readonly _hook: Hook.EffectHook;
  private readonly _scope: Scope;

  constructor(hook: Hook.EffectHook, scope: Scope) {
    this._hook = hook;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  commit(): void {
    const { cleanup, setup } = this._hook;
    cleanup?.();
    this._hook.setup = null;
    this._hook.cleanup = setup?.();
  }
}

function completeContext(
  context: FunctionComponentContext,
  scope: Scope,
  session: Session,
): void {
  // Cleanup effects follow the same declaration order within a component,
  // but must run from parent to child. Therefore, we collect cleanup effects
  // before all children are detached and then register them.
  for (const hook of context._hooks) {
    switch (hook.type) {
      case PassiveEffectType:
        enqueueInvokeEffect(hook, session.passiveEffects, scope);
        break;
      case LayoutEffectType:
        enqueueInvokeEffect(hook, session.layoutEffects, scope);
        break;
      case InsertionEffectType:
        enqueueInvokeEffect(hook, session.mutationEffects, scope);
        break;
    }
  }
}

function createEffectHook(
  context: FunctionComponentContext,
  setup: () => Cleanup | void,
  dependencies: readonly unknown[] | null,
  type: Hook.EffectHook['type'],
): void {
  let currentHook = context._hooks[context._hookIndex];

  if (currentHook !== undefined) {
    ensureHookType(type, currentHook);
    const { cleanup, memoizedDependencies } = currentHook;
    currentHook = {
      type,
      setup,
      cleanup,
      pendingDependencies: dependencies,
      memoizedDependencies,
    };
  } else {
    currentHook = {
      type,
      setup,
      cleanup: undefined,
      pendingDependencies: dependencies,
      memoizedDependencies: null,
    };
  }

  context._hooks[context._hookIndex] = currentHook;
  context._hookIndex++;
}

function createReducerHook<TState, TAction>(
  context: FunctionComponentContext,
  reducer: (state: TState, action: TAction) => TState,
  initialState: InitialState<TState>,
  options: StateOptions = {},
): Hook.ReducerHook<TState, TAction> {
  let currentHook = context._hooks[context._hookIndex];

  if (currentHook !== undefined) {
    ensureHookType(ReducerType, currentHook);

    const { dispatcher, memoizedState, memoizedActions } = currentHook;
    const renderLanes = context._session.lanes;
    let newState = options.passthrough
      ? getInitialState(initialState)
      : memoizedState;
    let skipLanes = NoLanes;

    memoizedActions.push(...dispatcher.pendingActions);

    for (const action of memoizedActions) {
      const { payload, lanes, revertLanes } = action;
      if ((lanes & renderLanes) === lanes) {
        newState = reducer(newState, payload);
        action.lanes = NoLanes;
      } else if ((revertLanes & renderLanes) === revertLanes) {
        skipLanes |= lanes;
        action.revertLanes = NoLanes;
      }
    }

    if (skipLanes === NoLanes) {
      currentHook = {
        type: ReducerType,
        dispatcher,
        memoizedState: newState,
        memoizedActions: [],
      };
    }

    dispatcher.pendingState = newState;
    dispatcher.pendingActions = [];
    dispatcher.reducer = reducer;
  } else {
    const dispatcher: ActionDispatcher<TState, TAction> = {
      dispatch(payload, options = {}) {
        const { pendingActions, pendingState, reducer } = this;

        if (pendingActions.length === 0) {
          const areStatesEqual = options.areStatesEqual ?? Object.is;
          const newState = reducer(pendingState, payload);

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
        pendingActions.push({
          payload,
          lanes: handle.lanes,
          revertLanes: options.transient ? handle.lanes : NoLanes,
        });
        return handle;
      },
      pendingActions: [],
      pendingState: getInitialState(initialState),
      reducer,
    };
    dispatcher.dispatch = dispatcher.dispatch.bind(dispatcher);
    currentHook = {
      type: ReducerType,
      memoizedState: dispatcher.pendingState,
      memoizedActions: [],
      dispatcher,
    };
  }

  context._hooks[context._hookIndex] = currentHook;
  context._hookIndex++;

  return currentHook;
}

function discardContext(
  context: FunctionComponentContext,
  scope: Scope,
  session: Session,
): void {
  // Cleanup effects follow the same declaration order within a component,
  // but must run from parent to child. Therefore, we collect cleanup effects
  // before all children are detached and then register them.
  for (const hook of context._hooks) {
    switch (hook.type) {
      case PassiveEffectType:
        enqueueCleanupEffect(hook, session.passiveEffects, scope);
        break;
      case LayoutEffectType:
        enqueueCleanupEffect(hook, session.layoutEffects, scope);
        break;
      case InsertionEffectType:
        enqueueCleanupEffect(hook, session.mutationEffects, scope);
        break;
    }
  }

  context._scope = Scope.orphan;
  context._session = session;
  context._hooks = [];
  context._hookIndex = 0;
}

function enqueueCleanupEffect(
  hook: Hook.EffectHook,
  effects: Effect[],
  scope: Scope,
): void {
  if (hook.cleanup !== undefined) {
    effects.push(new CleanupEffect(hook, scope));
  }
}

function enqueueInvokeEffect(
  hook: Hook.EffectHook,
  effects: Effect[],
  scope: Scope,
): void {
  if (
    areDependenciesChanged(hook.pendingDependencies, hook.memoizedDependencies)
  ) {
    effects.push(new InvokeEffect(hook, scope));
  }
}

function ensureHookType<TExpectedType extends Hook['type']>(
  expectedType: TExpectedType,
  hook: Hook,
): asserts hook is Hook & { type: TExpectedType } {
  if (hook.type !== expectedType) {
    throw new Error(
      `Unexpected hook type. Expected "${expectedType}" but got "${hook.type}".`,
    );
  }
}

function finalizeContext(context: FunctionComponentContext): void {
  let currentHook = context._hooks[context._hookIndex];

  if (currentHook !== undefined) {
    ensureHookType(FinalizerType, currentHook);
  } else {
    currentHook = { type: FinalizerType };
  }

  context._hooks[context._hookIndex] = currentHook;

  // Refuse to use new hooks after finalization.
  Object.freeze(context._hooks);
}

function getInitialState<TState>(initialState: InitialState<TState>): TState {
  return typeof initialState === 'function'
    ? (initialState as () => TState)()
    : initialState;
}

function resetContext(
  context: FunctionComponentContext,
  hooks: Hook[],
  scope: Scope,
  session: Session,
): void {
  context._scope = scope;
  context._session = session;
  context._hooks = hooks.slice();
  context._hookIndex = 0;
}
