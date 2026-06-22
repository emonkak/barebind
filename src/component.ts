import { patch } from './commit.js';
import { areDependenciesChanged } from './compare.js';
import {
  type Commit,
  type Component,
  type ComponentHandle,
  type Dispatcher,
  type Injectable,
  type Lanes,
  Ref,
  type Renderer,
  type RenderNode,
  type Scope,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateTransaction,
  type VComponent,
  type VElement,
  VNODE_KIND_COMPONENT,
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

interface Action<TState, TPayload> {
  payload: TPayload;
  eagerState: TState | undefined;
  lanes: Lanes;
  revertLanes: Lanes;
}

interface ActionHandler<TState, TPayload> {
  dispatch: (
    payload: TPayload,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle;
  reducer: (state: TState, action: TPayload) => TState;
  currentState: TState;
  pendingActions: Action<TState, TPayload>[];
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
    cleanup: EffectCleanup | void;
    deps: readonly unknown[] | null | undefined;
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
    handler: ActionHandler<TState, TAction>;
    memoizedActions: Action<TState, TAction>[];
    memoizedState: TState;
  }
}

type Usable<TReturn> = HookObject<TReturn> | HookFunction<TReturn>;

export class FunctionComponentHandle<TProps = any, TReturn = unknown>
  implements ComponentHandle<TProps>
{
  /** @internal */
  readonly _componentFn: ComponentFunction<TProps, TReturn>;
  /** @internal */
  readonly _dispatcher: Dispatcher;
  /** @internal */
  _connectedNode: RenderNode.ComponentNode | null = null;
  /** @internal */
  _pendingLanes: Lanes = NoLanes;
  /** @internal */
  _hooks: readonly Hook[] = [];

  constructor(
    componentFn: ComponentFunction<TProps, TReturn>,
    dispatcher: Dispatcher,
  ) {
    this._componentFn = componentFn;
    this._dispatcher = dispatcher;
  }

  get pendingLanes(): Lanes {
    return this._pendingLanes;
  }

  render(props: TProps, scope: Scope, lanes: Lanes): VElement {
    try {
      this._pendingLanes &= ~lanes;
      const context = new RenderContext(
        this,
        this._hooks.slice(),
        scope,
        lanes,
      );
      const returnValue = this._componentFn.call(context, props);
      this._hooks = finalizeContext(context);
      Object.freeze(scope.instances);
      return wrap(returnValue);
    } catch (cause) {
      throw new RenderError(scope, 'An error occurred during rendering.', {
        cause,
      });
    }
  }

  connect(node: RenderNode.ComponentNode<TProps>): void {
    for (const hook of this._hooks) {
      if (hook.type === EffectType && hook.dirty) {
        hook.cleanup?.();
        hook.cleanup = hook.setup();
        hook.dirty = false;
      }
    }
    this._connectedNode = node;
  }

  disconnect(): void {
    for (const hook of this._hooks) {
      if (hook.type === EffectType && hook.cleanup !== undefined) {
        hook.cleanup();
        hook.cleanup = undefined;
      }
    }
    this._connectedNode = null;
  }
}

export class RenderContext {
  private readonly _handle: FunctionComponentHandle;
  private readonly _lanes: Lanes;
  /** @internal */
  readonly _hooks: Hook[];
  /** @internal */
  _hookIndex: number = 0;
  /** @internal */
  _scope: Scope;

  constructor(
    instance: FunctionComponentHandle,
    hooks: Hook[],
    scope: Scope,
    lanes: Lanes,
  ) {
    this._handle = instance;
    this._hooks = hooks;
    this._scope = scope;
    this._lanes = lanes;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    const instance = this._handle;
    const handle = instance._dispatcher.schedule(
      new UpdateComponent(instance, this._scope.level),
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
    return callback(this._handle._dispatcher.nextTransition());
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
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType(EffectType, currentHook);
      currentHook = {
        ...currentHook,
        dirty:
          currentHook.dirty || areDependenciesChanged(currentHook.deps, deps),
        setup,
        deps,
      };
    } else {
      currentHook = {
        type: EffectType,
        setup,
        cleanup: undefined,
        deps,
        dirty: true,
      };
    }

    this._hooks[this._hookIndex++] = currentHook;
  }

  useId(): string {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType(IdType, currentHook);
    } else {
      currentHook = {
        type: IdType,
        id: this._handle._dispatcher.nextIdentifier(),
      };
    }

    this._hooks[this._hookIndex++] = currentHook;

    return currentHook.id;
  }

  useMemo<TResult>(
    computation: () => TResult,
    deps: readonly unknown[],
  ): TResult {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType(MemoType, currentHook);

      if (areDependenciesChanged(currentHook.deps, deps)) {
        currentHook = {
          ...currentHook,
          result: computation(),
          deps,
        };
      }
    } else {
      currentHook = {
        type: MemoType,
        result: computation(),
        deps,
      };
    }

    this._hooks[this._hookIndex++] = currentHook;

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
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType(ReducerType, currentHook);

      const { handler, memoizedState, memoizedActions } = currentHook;
      const renderLanes = this._lanes;
      let nextState = options.passthrough
        ? getInitialState(initialState)
        : memoizedState;
      let skipLanes = NoLanes;

      memoizedActions.push(...handler.pendingActions);

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
        currentHook = {
          ...currentHook,
          memoizedActions: [],
          memoizedState: nextState,
        };
      }

      handler.reducer = reducer;
      handler.currentState = nextState;
      handler.pendingActions = [];
    } else {
      const handler: ActionHandler<TState, TAction> = {
        dispatch: (payload, options = {}) => {
          const { pendingActions, currentState, reducer } = handler;
          let eagerState: TState | undefined;

          if (pendingActions.length === 0) {
            const areStatesEqual = options.areStatesEqual ?? Object.is;
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
        memoizedState: handler.currentState,
        memoizedActions: [],
        handler,
      };
    }

    this._hooks[this._hookIndex++] = currentHook;

    return [currentHook.handler.currentState, currentHook.handler.dispatch];
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
  { arePropsEqual = Object.is }: ComponentOptions<TProps> = {},
): Component<TProps> {
  function FunctionComponent(props: TProps): VComponent<TProps> {
    return new VNode(VNODE_KIND_COMPONENT, FunctionComponent, props, []);
  }

  FunctionComponent.createHandle = (
    dispatcher: Dispatcher,
  ): ComponentHandle<TProps> =>
    new FunctionComponentHandle(componentFn, dispatcher);
  FunctionComponent.arePropsEqual = arePropsEqual;

  DEBUG: {
    Object.defineProperty(FunctionComponent, 'name', {
      value: componentFn.name,
    });
  }

  return FunctionComponent;
}

class UpdateComponent implements UpdateTransaction {
  private readonly _handle: FunctionComponentHandle;
  private readonly _level: number;

  constructor(handle: FunctionComponentHandle, level: number) {
    this._handle = handle;
    this._level = level;
  }

  get level(): number {
    return this._level;
  }

  get pendingLanes(): Lanes {
    return this._handle._pendingLanes;
  }

  prepare(lanes: Lanes, renderer: Renderer): Commit {
    const oldNode = this._handle._connectedNode;
    if (oldNode === null) {
      return noOp;
    }
    const newNode: RenderNode.ComponentNode = {
      ...oldNode,
      children: oldNode.children.slice(),
      dirty: true,
    };
    const subScope = newNode.state.scope.enter(newNode.type);
    newNode.children[0] = renderer.diff(
      newNode.children[0]!,
      newNode.state.handle.render(newNode.props, subScope, lanes),
      subScope,
      0,
      newNode,
    );
    return () => {
      patch(oldNode, newNode);
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

function finalizeContext(context: RenderContext): readonly Hook[] {
  let currentHook = context._hooks[context._hookIndex];

  if (currentHook !== undefined) {
    ensureHookType(FinalizerType, currentHook);
  } else {
    currentHook = { type: FinalizerType };
  }

  context._hooks[context._hookIndex++] = currentHook;
  context._scope = context._scope.detach();

  return Object.freeze(context._hooks);
}

function getInitialState<TState>(initialState: InitialState<TState>): TState {
  return typeof initialState === 'function'
    ? (initialState as () => TState)()
    : initialState;
}

function noOp() {}
