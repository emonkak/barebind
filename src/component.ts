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
  type Scope,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateUnit,
  type VComponent,
  type VElement,
  type View,
  VNode,
  wrap,
} from './core.js';
import { RenderError } from './error.js';
import { NoLanes } from './lane.js';
import { patch } from './view.js';

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

export class Component<TProps = any, TReturn = unknown>
  implements ComponentInstance<TProps>
{
  /** @internal */
  readonly _componentFn: ComponentFunction<TProps, TReturn>;
  /** @internal */
  readonly _dispatcher: Dispatcher;
  /** @internal */
  _stagingView: View.ComponentView | null = null;
  /** @internal */
  _committedView: View.ComponentView | null = null;
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

  prepareRender(
    view: View.ComponentView<TProps>,
    element: VComponent<TProps>,
    lanes: Lanes,
  ): boolean {
    const dirty =
      (this._pendingLanes & lanes) !== NoLanes ||
      !view.type.arePropsEqual(view.props, element.props);
    if (!dirty) {
      this._stagingView = view;
      this._pendingLanes &= ~lanes;
    }
    return dirty;
  }

  render(
    view: View.ComponentView<TProps>,
    scope: Scope,
    lanes: Lanes,
  ): VElement {
    try {
      const context = new RenderContext(this, scope);
      const returnValue = this._componentFn.call(context, view.props);
      this._hooks = finalizeHooks(context);
      Object.freeze(scope.instances);
      return wrap(returnValue);
    } catch (cause) {
      throw new RenderError(view, 'An error occurred during rendering.', {
        cause,
      });
    } finally {
      this._stagingView = view;
      this._pendingLanes &= ~lanes;
    }
  }

  afterCommit(): void {
    for (const hook of this._hooks) {
      if (hook.type === EffectType && hook.dirty) {
        hook.cleanup?.();
        hook.cleanup = hook.setup();
        hook.dirty = false;
      }
    }
    this._committedView = this._stagingView;
  }

  beforeRemove(): void {
    for (const hook of this._hooks) {
      if (hook.type === EffectType && hook.cleanup !== undefined) {
        hook.cleanup();
        hook.cleanup = undefined;
      }
    }
    this._committedView = null;
  }
}

export class RenderContext {
  private readonly _instance: Component;
  private readonly _scope: Scope;
  /** internal */
  readonly _hooks: Hook[];
  /** internal */
  _hookIndex: number = 0;

  constructor(instance: Component, scope: Scope) {
    this._instance = instance;
    this._scope = scope;
    this._hooks = instance._hooks.slice();
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
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType(EffectType, currentHook);
      currentHook = {
        ...currentHook,
        dirty:
          currentHook.dirty || areDependenciesChange(currentHook.deps, deps),
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
        id: this._instance._dispatcher.nextIdentifier(),
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

      if (areDependenciesChange(currentHook.deps, deps)) {
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
      const renderLanes = this._instance._dispatcher.flushLanes;
      let newState = options.passthrough
        ? getInitialState(initialState)
        : memoizedState;
      let skipLanes = NoLanes;

      memoizedActions.push(...handler.pendingActions);

      for (const action of memoizedActions) {
        const { payload, lanes, revertLanes } = action;
        if ((lanes & renderLanes) === lanes) {
          newState = reducer(newState, payload);
          action.lanes = revertLanes;
        } else {
          if ((revertLanes & renderLanes) === revertLanes) {
            action.revertLanes = NoLanes;
          }
        }
        skipLanes |= (lanes & ~renderLanes) | (revertLanes & renderLanes);
      }

      if (skipLanes === NoLanes) {
        currentHook = {
          ...currentHook,
          memoizedActions: [],
          memoizedState: newState,
        };
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
            revertLanes: options.transient ? handle.lanes : NoLanes,
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
    }

    this._hooks[this._hookIndex++] = currentHook;

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
    dispatcher: Dispatcher,
  ): ComponentInstance<TProps> => new Component(componentFn, dispatcher);
  ComponentType.arePropsEqual = arePropsEqual;

  DEBUG: {
    Object.defineProperty(ComponentType, 'name', {
      value: componentFn.name,
    });
  }

  return ComponentType;
}

class UpdateComponent implements UpdateUnit {
  private readonly _instance: Component;
  private readonly _scope: Scope;

  constructor(instance: Component, scope: Scope) {
    this._instance = instance;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  get pendingLanes(): Lanes {
    return this._instance._pendingLanes;
  }

  prepare(lanes: Lanes, reconciler: Reconciler): Effect {
    const oldView = this._instance._committedView;
    if (oldView === null) {
      return noOp;
    }
    const newView: View.ComponentView = {
      ...oldView,
      id: reconciler.nextRenderId(),
      children: oldView.children.slice(),
    };
    const newScope = this._scope.peer();
    newView.children[0] = reconciler.diff(
      newView.children[0]!,
      newView.data.render(newView, newScope, lanes),
      newScope,
      0,
      newView,
    );
    return () => {
      patch(oldView, newView);
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

function finalizeHooks(context: RenderContext): readonly Hook[] {
  let currentHook = context._hooks[context._hookIndex];

  if (currentHook !== undefined) {
    ensureHookType(FinalizerType, currentHook);
  } else {
    currentHook = { type: FinalizerType };
  }

  context._hooks[context._hookIndex++] = currentHook;

  return Object.freeze(context._hooks);
}

function getInitialState<TState>(initialState: InitialState<TState>): TState {
  return typeof initialState === 'function'
    ? (initialState as () => TState)()
    : initialState;
}

function noOp() {}
