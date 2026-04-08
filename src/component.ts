import { areDepsChanged } from './compare.js';
import {
  type BoundaryType,
  type Component,
  Directive,
  type DirectiveHandler,
  type Effect,
  type Lanes,
  type Scope,
  type Session,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  wrap,
} from './core.js';
import { AbortError } from './error.js';
import { getRenderLanes, NoLanes } from './lane.js';
import {
  getRootScope,
  handleError,
  isChildScope,
  OrphanScope,
} from './scope.js';
import { Slot } from './slot.js';

const FinalizerType = 0;
const PassiveEffectType = 1;
const LayoutEffectType = 2;
const InsertionEffectType = 3;
const IdType = 4;
const MemoType = 5;
const ReducerType = 6;

export interface ComponentFunctionOptions<TProps> {
  arePropsEqual?: (newProps: TProps, oldProps: TProps) => boolean;
}

export type ComponentFunction<TProps, TReturn> = (
  this: RenderContext,
  props: TProps,
) => TReturn;

export type Usable<TReturn> =
  | Usable.UsableObject<TReturn>
  | Usable.UsableFunction<TReturn>;

export namespace Usable {
  export type UsableFunction<TReturn = void> = (
    context: RenderContext,
  ) => TReturn;

  export interface UsableObject<TReturn = void> {
    onUse(context: RenderContext): TReturn;
  }
}

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

interface DispatchOptions<TState> extends UpdateOptions {
  areStatesEqual?: (nextState: TState, prevState: TState) => boolean;
  transient?: boolean;
}

type EffectCleanup = () => void;

type EffectSetup = () => EffectCleanup | void;

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
    setup: EffectSetup | null;
    cleanup: EffectCleanup | void;
    pendingDeps: readonly unknown[] | null;
    currentDeps: readonly unknown[] | null;
  }

  export interface IdHook {
    type: typeof IdType;
    id: string;
  }

  export interface MemoHook<TResult> {
    type: typeof MemoType;
    memoizedResult: TResult;
    memoizedDeps: readonly unknown[] | null;
  }

  export interface ReducerHook<TState, TAction> {
    type: typeof ReducerType;
    dispatcher: ActionDispatcher<TState, TAction>;
    memoizedActions: Action<TAction>[];
    memoizedState: TState;
  }
}

type InitialState<T> = (T extends Function ? never : T) | (() => T);

type NextState<T> = (T extends Function ? never : T) | ((state: T) => T);

interface RefObject<T> {
  current: T;
}

interface StateOptions {
  passthrough?: boolean;
}

export class ComponentHandler<TProps, TReturn>
  implements DirectiveHandler<TProps>
{
  private readonly _componentFn: ComponentFunction<TProps, TReturn>;

  private readonly _arePropsEqual: (
    newProps: TProps,
    oldProps: TProps,
  ) => boolean;

  private _context: RenderContext | null = null;

  private _slot: Slot | null = null;

  constructor(
    componentFn: ComponentFunction<TProps, TReturn>,
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
    part: unknown,
    scope: Scope.ChildScope,
    session: Session,
  ): Iterable<Slot> {
    if (this._context !== null) {
      resetContext(this._context, scope, session);
    } else {
      this._context = new RenderContext(scope, session);
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
    _part: unknown,
    scope: Scope.ChildScope,
    session: Session,
  ): void {
    if (this._context !== null) {
      completeContext(this._context, scope, session);
    }
  }

  discard(
    _props: TProps,
    _part: unknown,
    scope: Scope,
    session: Session,
  ): void {
    if (this._context !== null) {
      discardContext(this._context, scope, session);
    }
    this._slot?.discard(session);
  }

  mount(_newValue: TProps, _oldValue: TProps | null, _part: unknown): void {
    this._slot?.commit();
    if (this._context !== null) {
      this._context._currentHooks = this._context._pendingHooks;
    }
  }

  unmount(_value: TProps, _part: unknown): void {
    this._slot?.revert();
    if (this._context !== null) {
      this._context._currentHooks = [];
    }
  }
}

export class RenderContext {
  /** @internal */
  _scope: Scope;
  /** @internal */
  _session: Session;
  /** @internal */
  _pendingHooks: Hook[] = [];
  /** @internal */
  _currentHooks: Hook[] = [];
  /** @internal */
  _hookIndex = 0;

  constructor(scope: Scope, session: Session) {
    this._scope = scope;
    this._session = session;
  }

  addBoundary<T>(instance: T): void {
    this._scope.boundary = {
      instance,
      next: this._scope.boundary,
    };
  }

  getBoundary<TInstance, TDefault = never>(
    type: BoundaryType<TInstance, TDefault>,
  ): TInstance | TDefault {
    let scope: Scope | null = this._scope;
    while (true) {
      for (
        let boundary = scope.boundary;
        boundary !== null;
        boundary = boundary.next
      ) {
        if (boundary.instance instanceof type) {
          return boundary.instance;
        }
      }
      if (!isChildScope(scope)) {
        break;
      }
      scope = scope.owner.scope;
    }
    if (type.getDefault !== undefined) {
      return type.getDefault();
    }
    throw new Error(
      `No ${type.name} found. Make sure to register its instance with context.addBoundary() before using it.`,
    );
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (!isChildScope(this._scope)) {
      return {
        id: -1,
        lanes: NoLanes,
        finished: Promise.resolve({
          status: 'skipped',
        }),
      };
    }
    if (!Object.isFrozen(this._scope)) {
      const renderLanes = getRenderLanes(options ?? {});
      const currentUpdate = this._session.scheduler.currentUpdate;
      if (
        currentUpdate !== undefined &&
        currentUpdate.id === this._session.id &&
        (currentUpdate.lanes & renderLanes) === renderLanes
      ) {
        this._scope.owner.pendingLanes |= currentUpdate.lanes;
        return {
          id: currentUpdate.id,
          lanes: currentUpdate.lanes,
          finished: currentUpdate.controller.promise,
        };
      }
    }
    const handle = this._session.scheduler.schedule(this._scope.owner, options);
    this._scope.owner.pendingLanes |= handle.lanes;
    return handle;
  }

  forwardError(error: unknown): void {
    try {
      handleError(this._scope, error);
    } catch (error) {
      throw new AbortError(
        this._scope,
        'No error boundary handled the error.',
        { cause: error },
      );
    }
  }

  nextId(): string {
    const root = getRootScope(this._scope);
    return root !== null ? root.owner.idPrefix + '-' + root.owner.idSeq++ : '';
  }

  startTransition<T>(action: (transition: number) => T): T {
    const transition = this._session.scheduler.nextTransition();
    const result = action(transition);
    if (result instanceof Promise) {
      result.catch((error) => {
        this.forwardError(error);
      });
    }
    return result;
  }

  use<TReturn>(usable: Usable<TReturn>): TReturn {
    return 'onUse' in usable ? usable.onUse(this) : usable(this);
  }

  useCallback<TCallback extends (...args: any[]) => any>(
    callback: TCallback,
    deps: readonly unknown[],
  ): TCallback {
    return this.useMemo(() => callback, deps);
  }

  useEffect(setup: EffectSetup, deps: readonly unknown[] | null = null): void {
    createEffectHook(this, setup, deps, PassiveEffectType);
  }

  useId(): string {
    let currentHook = this._pendingHooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType(IdType, currentHook);
    } else {
      currentHook = {
        type: IdType,
        id: this.nextId(),
      };
    }

    this._pendingHooks[this._hookIndex++] = currentHook;

    return currentHook.id;
  }

  useInsertionEffect(
    setup: EffectSetup,
    deps: readonly unknown[] | null = null,
  ): void {
    createEffectHook(this, setup, deps, InsertionEffectType);
  }

  useLayoutEffect(
    setup: EffectSetup,
    deps: readonly unknown[] | null = null,
  ): void {
    createEffectHook(this, setup, deps, LayoutEffectType);
  }

  useMemo<TResult>(
    computation: () => TResult,
    deps: readonly unknown[],
  ): TResult {
    let currentHook = this._pendingHooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType(MemoType, currentHook);

      if (areDepsChanged(deps, currentHook.memoizedDeps)) {
        currentHook = {
          type: MemoType,
          memoizedResult: computation(),
          memoizedDeps: deps,
        };
      }
    } else {
      currentHook = {
        type: MemoType,
        memoizedResult: computation(),
        memoizedDeps: deps,
      };
    }

    this._pendingHooks[this._hookIndex++] = currentHook;

    return currentHook.memoizedResult as TResult;
  }

  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
    options: StateOptions = {},
  ): [
    state: TState,
    dispatch: (
      action: TAction,
      options?: DispatchOptions<TState>,
    ) => UpdateHandle,
  ] {
    let currentHook = this._pendingHooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType(ReducerType, currentHook);

      const { dispatcher, memoizedState, memoizedActions } = currentHook;
      const renderLanes = this._session.lanes;
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
        dispatch: (payload, options = {}) => {
          const { pendingActions, pendingState, reducer } = dispatcher;

          if (pendingActions.length === 0) {
            const areStatesEqual = options.areStatesEqual ?? Object.is;
            const newState = reducer(pendingState, payload);

            if (areStatesEqual(newState, pendingState)) {
              return {
                id: -1,
                lanes: 0,
                finished: Promise.resolve<UpdateResult>({
                  status: 'skipped',
                }),
              };
            }
          }

          const handle = this.forceUpdate(options);
          pendingActions.push({
            payload,
            lanes: handle.lanes,
            revertLanes: options.transient ? handle.lanes : 0,
          });
          return handle;
        },
        pendingActions: [],
        pendingState: getInitialState(initialState),
        reducer,
      };
      currentHook = {
        type: ReducerType,
        memoizedState: dispatcher.pendingState,
        memoizedActions: [],
        dispatcher,
      };
    }

    this._pendingHooks[this._hookIndex++] = currentHook;

    return [
      currentHook.dispatcher.pendingState,
      currentHook.dispatcher.dispatch,
    ];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => Object.seal({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
    options?: StateOptions,
  ): [
    state: TState,
    setState: (
      nextState: NextState<TState>,
      options?: DispatchOptions<TState>,
    ) => UpdateHandle,
  ] {
    return this.useReducer<TState, NextState<TState>>(
      (state, action) =>
        typeof action === 'function'
          ? (action as (prevState: TState) => TState)(state)
          : action,
      initialState,
      options,
    );
  }
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

export function createComponent<TProps = {}, TReturn = unknown>(
  componentFn: ComponentFunction<TProps, TReturn>,
  { arePropsEqual = Object.is }: ComponentFunctionOptions<TProps> = {},
): Component<TProps> {
  function Component(props: TProps): Directive.ComponentDirective<TProps> {
    return new Directive(Component, props);
  }

  Component.resolveComponent = (
    _directive: Directive.ComponentDirective<TProps>,
    _part: unknown,
  ): DirectiveHandler<TProps> =>
    new ComponentHandler(componentFn, arePropsEqual);

  DEBUG: {
    Object.defineProperty(Component, 'name', {
      value: componentFn.name,
    });
  }

  return Component;
}

function completeContext(
  context: RenderContext,
  scope: Scope.ChildScope,
  session: Session,
): void {
  // Cleanup effects follow the same declaration order within a component,
  // but must run from parent to child. Therefore, we collect cleanup effects
  // before all children are detached and then register them.
  for (const hook of context._pendingHooks) {
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
  context: RenderContext,
  setup: EffectSetup,
  deps: readonly unknown[] | null,
  type: Hook.EffectHook['type'],
): void {
  let currentHook = context._pendingHooks[context._hookIndex];

  if (currentHook !== undefined) {
    ensureHookType(type, currentHook);
    const { cleanup, currentDeps } = currentHook;
    currentHook = {
      type,
      setup,
      cleanup,
      pendingDeps: deps,
      currentDeps,
    };
  } else {
    currentHook = {
      type,
      setup,
      cleanup: undefined,
      pendingDeps: deps,
      currentDeps: null,
    };
  }

  context._pendingHooks[context._hookIndex++] = currentHook;
}

function discardContext(
  context: RenderContext,
  scope: Scope,
  session: Session,
): void {
  // Cleanup effects follow the same declaration order within a component,
  // but must run from parent to child. Therefore, we collect cleanup effects
  // before all children are detached and then register them.
  for (const hook of context._pendingHooks) {
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

  context._scope = OrphanScope;
  context._session = session;
  context._pendingHooks = [];
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
  if (areDepsChanged(hook.pendingDeps, hook.currentDeps)) {
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

function finalizeContext(context: RenderContext): void {
  let currentHook = context._pendingHooks[context._hookIndex];

  if (currentHook !== undefined) {
    ensureHookType(FinalizerType, currentHook);
  } else {
    currentHook = { type: FinalizerType };
  }

  context._pendingHooks[context._hookIndex] = currentHook;

  // Refuse to use new hooks after finalization.
  Object.freeze(context._pendingHooks);
}

function getInitialState<TState>(initialState: InitialState<TState>): TState {
  return typeof initialState === 'function'
    ? (initialState as () => TState)()
    : initialState;
}

function resetContext(
  context: RenderContext,
  scope: Scope,
  session: Session,
): void {
  const baseHooks =
    session === context._session
      ? context._pendingHooks
      : context._currentHooks;
  context._scope = scope;
  context._session = session;
  context._pendingHooks = baseHooks.slice();
  context._hookIndex = 0;
}
