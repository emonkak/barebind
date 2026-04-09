import { areDepsChanged } from './compare.js';
import {
  type BoundaryType,
  type Component,
  Directive,
  type DirectiveHandler,
  type Lanes,
  type Scope,
  type Session,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  wrap,
} from './core.js';
import { NoLanes } from './lane.js';
import { isChildScope, OrphanScope } from './scope.js';
import { Slot } from './slot.js';

const FinalizerType = 0;
const EffectType = 1;
const IdType = 2;
const MemoType = 3;
const ReducerType = 4;

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
    type: typeof EffectType;
    setup: EffectSetup | null;
    cleanup: EffectCleanup | void;
    deps: readonly unknown[] | null;
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

    if (this._slot !== null) {
      this._slot.update(directive, scope);
    } else {
      this._slot = new Slot(part, directive, scope);
    }

    return [this._slot];
  }

  mount(_value: TProps, _part: unknown): void {
    this._slot?.commit();
  }

  remount(_oldValue: TProps, _newValue: TProps, _part: unknown): void {
    this._slot?.commit();
  }

  afterMount(_props: TProps, _part: unknown): void {
    this._slot?.afterCommit();
    if (this._context !== null) {
      for (const hook of this._context._hooks) {
        if (hook.type === EffectType && hook.setup !== null) {
          hook.cleanup?.();
          hook.cleanup = hook.setup();
          hook.setup = null;
        }
      }
    }
  }

  beforeUnmount(_props: TProps, _part: unknown): void {
    if (this._context !== null) {
      for (const hook of this._context._hooks) {
        if (hook.type === EffectType && hook.cleanup !== undefined) {
          hook.cleanup();
          hook.cleanup = undefined;
        }
      }

      this._context._scope = OrphanScope;
      this._context._hooks = [];
      this._context._hookIndex = 0;
    }
    this._slot?.beforeRevert();
  }

  unmount(_value: TProps, _part: unknown): void {
    this._slot?.revert();
  }
}

export class RenderContext {
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
    const handle = this._session.scheduler.schedule(this._scope.owner, options);
    this._scope.owner.pendingLanes |= handle.lanes;
    return handle;
  }

  inject<TInstance, TDefault = never>(
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
      `${type.name} could not be resolved in the current component hierarchy.`,
    );
  }

  provide<T>(instance: T): void {
    this._scope.boundary = {
      instance,
      next: this._scope.boundary,
    };
  }

  startTransition<T>(callback: (transition: number) => T): T {
    const transition = this._session.scheduler.nextTransition();
    return callback(transition);
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
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType(EffectType, currentHook);
      if (areDepsChanged(deps, currentHook.deps)) {
        currentHook.setup = setup;
        currentHook.deps = deps;
      }
    } else {
      currentHook = {
        type: EffectType,
        setup,
        cleanup: undefined,
        deps,
      };
      this._hooks.push(currentHook);
    }
  }

  useId(): string {
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType(IdType, currentHook);
    } else {
      currentHook = {
        type: IdType,
        id: this._session.scheduler.nextIdentifier(),
      };
      this._hooks.push(currentHook);
    }

    return currentHook.id;
  }

  useMemo<TResult>(
    computation: () => TResult,
    deps: readonly unknown[],
  ): TResult {
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType(MemoType, currentHook);

      if (areDepsChanged(deps, currentHook.memoizedDeps)) {
        currentHook.memoizedResult = computation();
        currentHook.memoizedDeps = deps;
      }
    } else {
      currentHook = {
        type: MemoType,
        memoizedResult: computation(),
        memoizedDeps: deps,
      };
      this._hooks.push(currentHook);
    }

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
    let currentHook = this._hooks[this._hookIndex++];

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
        currentHook.memoizedActions = [];
        currentHook.memoizedState = newState;
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
      this._hooks.push(currentHook);
    }

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
  let currentHook = context._hooks[context._hookIndex++];

  if (currentHook !== undefined) {
    ensureHookType(FinalizerType, currentHook);
  } else {
    currentHook = { type: FinalizerType };
    context._hooks.push(currentHook);
    Object.freeze(context._hooks);
  }
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
  context._scope = scope;
  context._session = session;
  context._hookIndex = 0;
}
