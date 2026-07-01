import { patch } from './commit.js';
import { areDependenciesChanged, is } from './compare.js';
import {
  type Commit,
  type Component,
  type ComponentInstance,
  type Dispatcher,
  type Injectable,
  type Lanes,
  Ref,
  type Renderer,
  type RenderNode,
  type Scope,
  type Transaction,
  type UpdateHandle,
  type UpdateOptions,
  type VComponent,
  type VElement,
  VNode,
  wrap,
} from './core.js';
import { RenderError } from './error.js';
import { NoLanes } from './lane.js';

const FinalizerType = 0;
const EffectType = 1;
const IdType = 2;
const MemoType = 3;
const ReducerType = 4;

export type ComponentFunction<TProps, TReturn> = (
  this: RenderContext,
  props: TProps,
) => TReturn;

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

interface Action<TState, TAction> {
  payload: TAction;
  eagerState: TState | undefined;
  lanes: Lanes;
  revertLanes: Lanes;
}

interface ActionDispatcher<TState, TAction> {
  dispatch: (
    action: TAction,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle;
  reducer: (state: TState, action: TAction) => TState;
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
    type: typeof FinalizerType;
  }

  export interface EffectHook {
    type: typeof EffectType;
    setup: EffectSetup;
    deps: readonly unknown[] | null | undefined;
    cleanup: EffectCleanup | void;
    dirty: boolean;
  }

  export interface IdHook {
    type: typeof IdType;
    id: string;
  }

  export interface MemoHook<TResult> {
    type: typeof MemoType;
    result: TResult;
    deps: readonly unknown[] | null | undefined;
  }

  export interface ReducerHook<TState, TAction> {
    type: typeof ReducerType;
    dispatcher: ActionDispatcher<TState, TAction>;
    memoizedActions: Action<TState, TAction>[];
    memoizedState: TState;
  }
}

type Usable<TReturn> = HookObject<TReturn> | HookFunction<TReturn>;

export class FunctionComponent<TProps = any, TReturn = unknown>
  implements ComponentInstance<TProps>
{
  /** @internal */
  readonly _component: ComponentFunction<TProps, TReturn>;
  /** @internal */
  readonly _dispatcher: Dispatcher;
  /** @internal */
  _pendingLanes: Lanes = NoLanes;
  /** @internal */
  _context: RenderContext | null = null;
  /** @internal */
  _connectedNode: RenderNode.ComponentNode | null = null;

  constructor(
    component: ComponentFunction<TProps, TReturn>,
    dispatcher: Dispatcher,
  ) {
    this._component = component;
    this._dispatcher = dispatcher;
  }

  get pendingLanes(): Lanes {
    return this._pendingLanes;
  }

  render(props: TProps, scope: Scope, lanes: Lanes): VElement {
    this._pendingLanes &= ~lanes;
    if (this._context !== null) {
      this._context._scope = scope;
      this._context._lanes = lanes;
      this._context._hookIndex = 0;
    } else {
      this._context = new RenderContext(this, scope, lanes);
    }
    try {
      const returnValue = this._component.call(this._context, props);
      finalizeContext(this._context);
      Object.freeze(scope.instances);
      return wrap(returnValue);
    } catch (cause) {
      throw new RenderError(scope, 'An error occurred during rendering.', {
        cause,
      });
    }
  }

  connect(node: RenderNode.ComponentNode<TProps>): void {
    for (const hook of this._context!._hooks) {
      if (hook.type === EffectType && hook.dirty) {
        hook.cleanup?.();
        hook.cleanup = hook.setup();
        hook.dirty = false;
      }
    }
    this._connectedNode = node;
  }

  disconnect(): void {
    for (const hook of this._context!._hooks) {
      if (hook.type === EffectType && hook.cleanup !== undefined) {
        hook.cleanup();
        hook.cleanup = undefined;
      }
    }
    this._connectedNode = null;
  }
}

export class RenderContext {
  private readonly _instance: FunctionComponent;
  /** @internal */
  _scope: Scope;
  /** @internal */
  _lanes: Lanes;
  /** @internal */
  _hooks: Hook[] = [];
  /** @internal */
  _hookIndex: number = 0;

  constructor(instance: FunctionComponent, scope: Scope, lanes: Lanes) {
    this._instance = instance;
    this._scope = scope;
    this._lanes = lanes;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    const instance = this._instance;
    const handle = instance._dispatcher.schedule(
      new UpdateComponent(instance, this._scope),
      options,
    );
    instance._pendingLanes |= handle.lanes;
    return handle;
  }

  inject<TInstance, TDefault = never>(
    injectable: Injectable<TInstance, TDefault>,
  ): TInstance | TDefault {
    for (
      let scope: Scope | null = this._scope;
      scope !== null;
      scope = scope.parent
    ) {
      for (let i = scope.instances.length - 1; i >= 0; i--) {
        const instance = scope.instances[i]!;
        if (instance instanceof injectable) {
          return instance;
        }
      }
    }
    if (injectable.getDefault !== undefined) {
      return injectable.getDefault();
    }
    throw new ReferenceError(
      `${injectable.name} could not be resolved in the current component hierarchy.`,
    );
  }

  provide<T extends object>(instance: T): void {
    this._scope.instances.push(instance);
  }

  startTransition<T>(callback: (transition: number) => T): T {
    return callback(this._instance._dispatcher.nextTransition());
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
      ensureHookType(EffectType, currentHook);
      currentHook.dirty ||= areDependenciesChanged(currentHook.deps, deps);
      currentHook.setup = setup;
      currentHook.deps = deps;
    } else {
      currentHook = {
        type: EffectType,
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
      ensureHookType(IdType, currentHook);
    } else {
      currentHook = {
        type: IdType,
        id: this._instance._dispatcher.nextIdentifier(),
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
      if (areDependenciesChanged(currentHook.deps, deps)) {
        currentHook.result = computation();
      }
      currentHook.deps = deps;
    } else {
      currentHook = {
        type: MemoType,
        result: computation(),
        deps,
      };
      this._hooks.push(currentHook);
    }

    return currentHook.result as TResult;
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
      const renderLanes = this._lanes;
      let nextState = options.passthrough
        ? getInitialState(initialState)
        : memoizedState;
      let skipLanes = NoLanes;

      memoizedActions.push(...dispatcher.pendingActions);

      for (const action of memoizedActions) {
        const { payload, lanes, revertLanes } = action;
        if ((lanes & renderLanes) === lanes) {
          nextState = action.eagerState ?? reducer(nextState, payload);
          action.lanes = revertLanes;
        } else if ((revertLanes & renderLanes) === revertLanes) {
          action.revertLanes = NoLanes;
        }
        skipLanes |= (lanes & ~renderLanes) | (revertLanes & renderLanes);
      }

      if (skipLanes === NoLanes) {
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
                lanes: NoLanes,
                finished: Promise.resolve(),
              };
            }
          }

          const handle = this.forceUpdate(options);
          pendingActions.push({
            payload,
            eagerState,
            lanes: handle.lanes,
            revertLanes: options.transient ? handle.lanes : NoLanes,
          });
          return handle;
        },
        reducer,
        currentState: getInitialState(initialState),
        pendingActions: [],
      };
      currentHook = {
        type: ReducerType,
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
  { arePropsEqual = is }: ComponentOptions<TProps> = {},
): Component<TProps> {
  function Component(props: TProps): VComponent<TProps> {
    return new VNode(Component, props, []);
  }

  Component.createInstance = (
    dispatcher: Dispatcher,
  ): ComponentInstance<TProps> =>
    new FunctionComponent(componentFn, dispatcher);
  Component.arePropsEqual = arePropsEqual;

  DEBUG: {
    Object.defineProperty(Component, 'name', {
      value: componentFn.name,
    });
  }

  return Component;
}

class UpdateComponent implements Transaction {
  private readonly _instance: FunctionComponent;
  private readonly _scope: Scope;

  constructor(instance: FunctionComponent, scope: Scope) {
    this._instance = instance;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  get pendingLanes(): Lanes {
    return this._instance._pendingLanes;
  }

  prepare(lanes: Lanes, renderer: Renderer): Commit {
    const node = this._instance._connectedNode;
    if (node === null) {
      return noOp;
    }
    const subScope = node.state.scope.enter(node.type);
    const newElement = node.state.instance.render(node.props, subScope, lanes);
    node.left = [renderer.diff(node.right[0]!, newElement, subScope, 0, node)];
    return () => {
      patch(node.right[0]!, node.left[0]!);
      node.state.instance.connect(node);
      node.right = node.left;
    };
  }
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

function noOp() {}
