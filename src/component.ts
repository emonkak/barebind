import { areDependenciesChange } from './compare.js';
import {
  type ComponentInstance,
  type ComponentType,
  type Dispatcher,
  type Effect,
  type Injectable,
  type Lanes,
  type Reconciler,
  Ref,
  type RenderTree,
  Scope,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateUnit,
  type VComponent,
  type VElement,
  VNode,
  wrap,
} from './core.js';
import { RenderError } from './error.js';
import { NoLanes } from './lane.js';
import { patch } from './tree.js';

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

export type Usable<TReturn> = UsableObject<TReturn> | UsableFunction<TReturn>;

export type UsableFunction<TReturn = void> = (
  context: RenderContext,
) => TReturn;

export interface UsableObject<TReturn = void> {
  onUse(context: RenderContext): TReturn;
}

export type InitialState<T> = (T extends Function ? never : T) | (() => T);

export type NextState<T> = (T extends Function ? never : T) | ((state: T) => T);

export interface StateOptions {
  passthrough?: boolean;
}

interface Action<TPayload> {
  payload: TPayload;
  lanes: Lanes;
  revertLanes: Lanes;
}

interface ActionHandler<TState, TPayload> {
  dispatch: (
    payload: TPayload,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle;
  pendingActions: Action<TPayload>[];
  pendingState: TState;
  reducer: (state: TState, action: TPayload) => TState;
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
    memoizedActions: Action<TAction>[];
    memoizedState: TState;
  }
}

export class Component<TProps, TReturn> implements ComponentInstance<TProps> {
  private readonly _componentFn: ComponentFunction<TProps, TReturn>;
  private readonly _context: RenderContext;

  constructor(
    componentFn: ComponentFunction<TProps, TReturn>,
    context: RenderContext,
  ) {
    this._componentFn = componentFn;
    this._context = context;
  }

  afterCommit(): void {
    for (const hook of this._context._hooks) {
      if (hook.type === EffectType && hook.dirty) {
        hook.cleanup?.();
        hook.cleanup = hook.setup();
        hook.dirty = false;
      }
    }
  }

  beforeRemove(): void {
    for (const hook of this._context._hooks) {
      if (hook.type === EffectType && hook.cleanup !== undefined) {
        hook.cleanup();
        hook.cleanup = undefined;
      }
    }
  }

  connect(tree: RenderTree.ComponentNode<TProps>): void {
    this._context._tree = tree;
    this._context._hookIndex = 0;
  }

  render(tree: RenderTree.ComponentNode<TProps>): VElement {
    try {
      const returnValue = this._componentFn.call(this._context, tree.props);
      finalizeHooks(this._context);
      Object.freeze(tree.scope.instances);
      return wrap(returnValue);
    } catch (cause) {
      throw new RenderError(tree, 'An error occurred during rendering.', {
        cause,
      });
    }
  }
}

export class RenderContext {
  private readonly _dispatcher: Dispatcher;
  /** @internal */
  _tree: RenderTree.ComponentNode | null = null;
  /** @internal */
  _hooks: Hook[] = [];
  /** @internal */
  _hookIndex = 0;

  constructor(dispatcher: Dispatcher) {
    this._dispatcher = dispatcher;
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (this._tree === null) {
      return {
        id: -1,
        lanes: NoLanes,
        finished: Promise.resolve(),
      };
    }
    return this._dispatcher.schedule(new UpdateComponent(this._tree), options);
  }

  inject<TInstance, TDefault = never>(
    injectable: Injectable<TInstance, TDefault>,
  ): TInstance | TDefault {
    let scope: Scope | null = this._tree?.scope ?? null;
    while (scope !== null) {
      for (const instance of scope.instances) {
        if (instance instanceof injectable) {
          return instance;
        }
      }
      scope = scope.parent;
    }
    if (injectable.getDefault !== undefined) {
      return injectable.getDefault();
    }
    throw new ReferenceError(
      `${injectable.name} could not be resolved in the current component hierarchy.`,
    );
  }

  provide<T extends object>(instance: T): void {
    this._tree?.scope.instances.push(instance);
  }

  startTransition<T>(callback: (transition: number) => T): T {
    return callback(this._dispatcher.nextTransition());
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
      currentHook.setup = setup;
      currentHook.deps = deps;
      currentHook.dirty = areDependenciesChange(currentHook.deps, deps);
    } else {
      currentHook = {
        type: EffectType,
        setup,
        cleanup: undefined,
        deps,
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
        id: this._dispatcher.nextIdentifier(),
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

      if (areDependenciesChange(currentHook.deps, deps)) {
        currentHook.result = computation();
        currentHook.deps = deps;
      }
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

      const { handler, memoizedState, memoizedActions } = currentHook;
      const renderLanes = this._dispatcher.flushLanes;
      let newState = options.passthrough
        ? getInitialState(initialState)
        : memoizedState;
      let skipLanes = NoLanes;

      memoizedActions.push(...handler.pendingActions);

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

      handler.pendingState = newState;
      handler.pendingActions = [];
      handler.reducer = reducer;
    } else {
      const handler: ActionHandler<TState, TAction> = {
        dispatch: (payload, options = {}) => {
          const { pendingActions, pendingState, reducer } = handler;

          if (pendingActions.length === 0) {
            const areStatesEqual = options.areStatesEqual ?? Object.is;
            const newState = reducer(pendingState, payload);

            if (areStatesEqual(newState, pendingState)) {
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
        memoizedState: handler.pendingState,
        memoizedActions: [],
        handler,
      };
      this._hooks.push(currentHook);
    }

    return [currentHook.handler.pendingState, currentHook.handler.dispatch];
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
): ComponentType<TProps> {
  function ComponentType(props: TProps): VComponent<TProps> {
    return new VNode(ComponentType, props, []);
  }

  ComponentType.newInstance = (
    _props: TProps,
    dispatcher: Dispatcher,
  ): ComponentInstance<TProps> =>
    new Component(componentFn, new RenderContext(dispatcher));
  ComponentType.arePropsEqual = arePropsEqual;

  DEBUG: {
    Object.defineProperty(ComponentType, 'name', {
      value: componentFn.name,
    });
  }

  return ComponentType;
}

class UpdateComponent implements UpdateUnit {
  private readonly _tree: RenderTree.ComponentNode;

  constructor(tree: RenderTree.ComponentNode) {
    this._tree = tree;
  }

  get scope(): Scope {
    return this._tree.scope;
  }

  prepare(reconciler: Reconciler): Effect {
    const newTree: RenderTree.ComponentNode = {
      ...this._tree,
      id: reconciler.nextRenderId(),
      children: new Array(1),
      scope: new Scope(this._tree.scope.parent),
    };
    newTree.instance.connect(newTree);
    const returnElement = newTree.instance.render(newTree);
    newTree.children[0] = reconciler.diff(
      this._tree.children[0]!,
      returnElement,
      newTree.scope,
      0,
      newTree,
    );
    return () => {
      patch(this._tree, newTree);
    };
  }
}

function finalizeHooks(context: RenderContext) {
  let currentHook = context._hooks[context._hookIndex++];

  if (currentHook !== undefined) {
    ensureHookType(FinalizerType, currentHook);
  } else {
    currentHook = { type: FinalizerType };
    context._hooks.push(currentHook);
    Object.freeze(context._hooks);
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

function getInitialState<TState>(initialState: InitialState<TState>): TState {
  return typeof initialState === 'function'
    ? (initialState as () => TState)()
    : initialState;
}
