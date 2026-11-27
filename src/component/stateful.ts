import {
  type Component,
  type ComponentRenderer,
  type Dispatcher,
  type Injectable,
  type Injection,
  type Lanes,
  type RenderNode,
  type RenderResult,
  type Scope,
  type UpdateHandle,
  type UpdateOptions,
  type VComponent,
  VNode,
} from '../abstractions.js';
import { areDependenciesChanged, is } from '../compare.js';
import { RenderError } from '../error.js';
import { Lane } from '../lane.js';
import { areScopesDirty, enterScope } from '../scope.js';
import { UpdateComponent } from '../transaction.js';
import { Ref, wrap } from '../vnode.js';

const enum HookType {
  FINALIZER = 0,
  EFFECT = 1,
  ID = 2,
  MEMO = 3,
  REDUCER = 4,
}

export interface ComponentOptions<TProps> {
  arePropsEqual?: (oldProps: TProps, newProps: TProps) => boolean;
}

export interface DispatchOptions<TState> extends UpdateOptions {
  areStatesEqual?: (nextState: TState, prevState: TState) => boolean;
  transient?: boolean;
}

export type HookFunction<TReturn = void> = (context: RenderContext) => TReturn;

export interface HookObject<TReturn = void> {
  onUse(context: RenderContext): TReturn;
}

export type InitialState<T> = (T extends Function ? never : T) | (() => T);

export type NextState<T> = (T extends Function ? never : T) | ((state: T) => T);

export interface StateOptions {
  passthrough?: boolean;
}

export type StatefulComponentFunction<TProps, TReturn> = (
  this: RenderContext,
  props: TProps,
) => TReturn;

interface Action<TState, TAction> {
  payload: TAction;
  eagerState: TState | undefined;
  lanes: Lanes;
  revertLanes: Lanes;
}

interface ActionDispatcher<TState, TAction> {
  dispatch: (
    payload: TAction,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle;
  reducer: (state: TState, payload: TAction) => TState;
  currentState: TState;
  pendingActions: Action<TState, TAction>[];
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
    type: HookType.FINALIZER;
  }

  export interface EffectHook {
    type: HookType.EFFECT;
    setup: EffectSetup;
    deps: readonly unknown[] | null | undefined;
    cleanup: EffectCleanup | void;
    dirty: boolean;
  }

  export interface IdHook {
    type: HookType.ID;
    id: string;
  }

  export interface MemoHook<TResult> {
    type: HookType.MEMO;
    result: TResult;
    deps: readonly unknown[] | null | undefined;
  }

  export interface ReducerHook<TState, TAction> {
    type: HookType.REDUCER;
    dispatcher: ActionDispatcher<TState, TAction>;
    memoizedActions: Action<TState, TAction>[];
    memoizedState: TState;
  }
}

type Usable<TReturn> = HookObject<TReturn> | HookFunction<TReturn>;

export class RenderContext {
  /** @internal */
  _pendingNode: RenderNode.ComponentNode;
  /** @internal */
  _pendingScope: Scope.Child;
  /** @internal */
  _currentNode: RenderNode.ComponentNode | null = null;
  /** @internal */
  _currentScope: Scope.Child | null = null;
  /** @internal */
  _renderLanes: Lanes;
  /** @internal */
  _hooks: Hook[] = [];
  /** @internal */
  _hookIndex: number = 0;

  constructor(
    node: RenderNode.ComponentNode,
    scope: Scope.Child,
    renderLanes: Lanes,
  ) {
    this._pendingNode = node;
    this._pendingScope = scope;
    this._renderLanes = renderLanes;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    const dispatcher = (
      this._pendingNode.state.renderer as StatefulComponentRenderer
    )._dispatcher;
    let targetNode: RenderNode;
    let targetScope: Scope;
    if (
      dispatcher.renderLanes !== Lane.NoLanes &&
      this._pendingNode.state.txId === dispatcher.txId
    ) {
      targetNode = this._pendingNode;
      targetScope = this._pendingScope;
    } else {
      targetNode = this._currentNode ?? this._pendingNode;
      targetScope = this._currentScope ?? this._pendingScope;
    }
    const transaction = new UpdateComponent(targetNode, targetScope);
    const handle = dispatcher.schedule(transaction, options);
    this._renderLanes &= ~handle.lanes;
    this._pendingNode.state.pendingLanes |= handle.lanes;
    return handle;
  }

  inject<TInstance, TDefault = never>(
    injectable: Injectable<TInstance, TDefault>,
  ): TInstance | TDefault {
    let injection: Injection | null = this._pendingScope.injection;
    while (injection !== null) {
      const instance = injection.instance;
      if (instance instanceof injectable) {
        return instance;
      }
      injection = injection.next;
    }
    if (injectable.getDefault !== undefined) {
      return injectable.getDefault();
    }
    throw new ReferenceError(
      `${injectable.name} could not be resolved in the current component hierarchy.`,
    );
  }

  provide<T extends object>(instance: T): void {
    this._pendingScope.injection = {
      instance,
      next: this._pendingScope.injection,
    };
  }

  startTransition<T>(callback: (transition: number) => T): T {
    const dispatcher = (
      this._pendingNode.state.renderer as StatefulComponentRenderer
    )._dispatcher;
    return callback(dispatcher.nextTransition());
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

  useEffect(
    setup: EffectSetup,
    deps?: readonly unknown[] | null | undefined,
  ): void {
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType(HookType.EFFECT, currentHook);
      currentHook.dirty ||= areDependenciesChanged(currentHook.deps, deps);
      currentHook.setup = setup;
      currentHook.deps = deps;
    } else {
      currentHook = {
        type: HookType.EFFECT,
        setup,
        deps,
        cleanup: undefined,
        dirty: true,
      };
      this._hooks.push(currentHook);
    }
  }

  useId(): string {
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType(HookType.ID, currentHook);
    } else {
      const dispatcher = (
        this._pendingNode.state.renderer as StatefulComponentRenderer
      )._dispatcher;
      currentHook = {
        type: HookType.ID,
        id: dispatcher.nextIdentifier(),
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
      ensureHookType(HookType.MEMO, currentHook);
      if (areDependenciesChanged(currentHook.deps, deps)) {
        currentHook.result = computation();
      }
      currentHook.deps = deps;
    } else {
      currentHook = {
        type: HookType.MEMO,
        result: computation(),
        deps,
      };
      this._hooks.push(currentHook);
    }

    return currentHook.result as TResult;
  }

  useReducer<TState, TAction>(
    reducer: (state: TState, payload: TAction) => TState,
    initialState: InitialState<TState>,
    options: StateOptions = {},
  ): [
    state: TState,
    dispatch: (
      payload: TAction,
      options?: DispatchOptions<TState>,
    ) => UpdateHandle,
  ] {
    let currentHook = this._hooks[this._hookIndex++];

    if (currentHook !== undefined) {
      ensureHookType(HookType.REDUCER, currentHook);

      const { dispatcher, memoizedState, memoizedActions } = currentHook;
      const renderLanes = this._renderLanes;
      let nextState = options.passthrough
        ? getInitialState(initialState)
        : memoizedState;
      let skipLanes = Lane.NoLanes;

      memoizedActions.push(...dispatcher.pendingActions);

      for (const action of memoizedActions) {
        const { payload, lanes, revertLanes } = action;
        if ((lanes & renderLanes) === lanes) {
          nextState = action.eagerState ?? reducer(nextState, payload);
          action.lanes = revertLanes;
        } else if ((revertLanes & renderLanes) === revertLanes) {
          action.revertLanes = Lane.NoLanes;
        }
        skipLanes |= (lanes & ~renderLanes) | (revertLanes & renderLanes);
      }

      if (skipLanes === Lane.NoLanes) {
        currentHook.memoizedActions = [];
        currentHook.memoizedState = nextState;
      }

      dispatcher.reducer = reducer;
      dispatcher.currentState = nextState;
      dispatcher.pendingActions = [];
    } else {
      const dispatcher: ActionDispatcher<TState, TAction> = {
        dispatch: (payload, options = {}) => {
          const { pendingActions, currentState, reducer } = dispatcher;
          let eagerState: TState | undefined;

          if (pendingActions.length === 0) {
            const areStatesEqual = options.areStatesEqual ?? is;
            eagerState = reducer(currentState, payload);

            if (areStatesEqual(eagerState, currentState)) {
              return {
                id: -1,
                lanes: Lane.NoLanes,
                finished: Promise.resolve(),
              };
            }
          }

          const handle = this.forceUpdate(options);
          pendingActions.push({
            payload,
            eagerState,
            lanes: handle.lanes,
            revertLanes: options.transient ? handle.lanes : Lane.NoLanes,
          });
          return handle;
        },
        reducer,
        currentState: getInitialState(initialState),
        pendingActions: [],
      };
      currentHook = {
        type: HookType.REDUCER,
        memoizedState: dispatcher.currentState,
        memoizedActions: [],
        dispatcher,
      };
      this._hooks.push(currentHook);
    }

    return [
      currentHook.dispatcher.currentState,
      currentHook.dispatcher.dispatch,
    ];
  }

  useRef<T>(initialValue: T): Ref<T> {
    return this.useMemo(() => new Ref(initialValue), []);
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
      (state, payload) =>
        typeof payload === 'function'
          ? (payload as (prevState: TState) => TState)(state)
          : payload,
      initialState,
      options,
    );
  }
}

export function createComponent<TProps = {}, TReturn = unknown>(
  componentFn: StatefulComponentFunction<TProps, TReturn>,
  { arePropsEqual = is }: ComponentOptions<TProps> = {},
): Component<TProps> {
  function Component(props: TProps): VComponent<TProps> {
    return new VNode(Component, props, []);
  }

  Component.createRenderer = (
    dispatcher: Dispatcher,
  ): ComponentRenderer<TProps> =>
    new StatefulComponentRenderer(dispatcher, componentFn, arePropsEqual);

  DEBUG: {
    Object.defineProperty(Component, 'name', {
      value: componentFn.name,
    });
  }

  return Component;
}

class StatefulComponentRenderer<TProps = any, TReturn = unknown>
  implements ComponentRenderer<TProps>
{
  /** @internal */
  readonly _dispatcher: Dispatcher;
  private readonly _componentFn: StatefulComponentFunction<TProps, TReturn>;
  private readonly _arePropsEqual: (
    oldProps: TProps,
    newProps: TProps,
  ) => boolean;
  private _context: RenderContext | null = null;

  constructor(
    dispatcher: Dispatcher,
    componentFn: StatefulComponentFunction<TProps, TReturn>,
    arePropsEqual: (oldProps: TProps, newProps: TProps) => boolean,
  ) {
    this._dispatcher = dispatcher;
    this._componentFn = componentFn;
    this._arePropsEqual = arePropsEqual;
  }

  afterCommit(): void {
    commitContext(this._context!);
  }

  beforeUnmount(): void {
    releaseContext(this._context!);
  }

  render(
    node: RenderNode.ComponentNode<TProps>,
    scope: Scope,
    renderLanes: Lanes,
  ): RenderResult {
    const oldScope = this._context?._pendingScope;
    const newScope = enterScope(scope, node.type);
    if (this._context !== null) {
      this._context._pendingNode = node;
      this._context._pendingScope = newScope;
      this._context._renderLanes = renderLanes;
      this._context._hookIndex = 0;
    } else {
      this._context = new RenderContext(node, newScope, renderLanes);
    }
    try {
      const element = wrap(this._componentFn.call(this._context, node.props));
      const dirty =
        oldScope === undefined || areScopesDirty(oldScope, newScope);
      finalizeHooks(this._context);
      return {
        element,
        scope: Object.freeze(newScope),
        consumedLanes: this._context._renderLanes,
        dirty,
      };
    } catch (cause) {
      throw RenderError.withScope(
        newScope,
        'An error occurred during rendering.',
        {
          cause,
        },
      );
    } finally {
      this._context!._renderLanes = Lane.NoLanes;
    }
  }

  shouldRender(oldProps: TProps, newProps: TProps): boolean {
    const arePropsEqual = this._arePropsEqual;
    return !arePropsEqual(oldProps, newProps);
  }
}

function commitContext(context: RenderContext): void {
  for (const hook of context._hooks) {
    if (hook.type === HookType.EFFECT && hook.dirty) {
      hook.cleanup?.();
      hook.cleanup = hook.setup();
      hook.dirty = false;
    }
  }
  context._currentNode = context._pendingNode;
  context._currentScope = context._pendingScope;
}

function ensureHookType<TExpectedType extends Hook['type']>(
  expectedType: TExpectedType,
  hook: Hook,
): asserts hook is Hook & { type: TExpectedType } {
  if (hook.type !== expectedType) {
    throw new TypeError(
      `Unexpected hook type. Expected "${expectedType}" but got "${hook.type}".`,
    );
  }
}

function finalizeHooks(context: RenderContext): void {
  let currentHook = context._hooks[context._hookIndex++];

  if (currentHook !== undefined) {
    ensureHookType(HookType.FINALIZER, currentHook);
  } else {
    currentHook = { type: HookType.FINALIZER };
    context._hooks.push(currentHook);
    Object.freeze(context._hooks);
  }
}

function getInitialState<TState>(initialState: InitialState<TState>): TState {
  return typeof initialState === 'function'
    ? (initialState as () => TState)()
    : initialState;
}

function releaseContext(context: RenderContext): void {
  for (const hook of context._hooks) {
    if (hook.type === HookType.EFFECT && hook.cleanup !== undefined) {
      hook.cleanup();
      hook.cleanup = undefined;
    }
  }
  context._currentNode = null;
  context._currentScope = null;
}
