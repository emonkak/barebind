import { areDependenciesChange } from './compare.js';
import {
  type BoundaryType,
  type ComponentInstance,
  type ComponentType,
  createScope,
  type Lanes,
  type Reconciler,
  Ref,
  type RenderChild,
  type Scope,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type UpdateScheduler,
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

export type RenderContext = Pick<
  Component<unknown, unknown>,
  | 'forceUpdate'
  | 'inject'
  | 'provide'
  | 'startTransition'
  | 'use'
  | 'useCallback'
  | 'useEffect'
  | 'useId'
  | 'useMemo'
  | 'useReducer'
  | 'useRef'
  | 'useState'
>;

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
    dispatcher: ActionDispatcher<TState, TAction>;
    memoizedActions: Action<TAction>[];
    memoizedState: TState;
  }
}

type InitialState<T> = (T extends Function ? never : T) | (() => T);

type NextState<T> = (T extends Function ? never : T) | ((state: T) => T);

interface StateOptions {
  passthrough?: boolean;
}

export class Component<TProps, TReturn> implements ComponentInstance<TProps> {
  private readonly _componentFn: ComponentFunction<TProps, TReturn>;
  private readonly _scheduler: UpdateScheduler;
  private _origin: RenderChild.ComponentChild<TProps> | null = null;
  private _hooks: Hook[] = [];
  private _hookIndex = 0;

  constructor(
    componentFn: ComponentFunction<TProps, TReturn>,
    scheduler: UpdateScheduler,
  ) {
    this._componentFn = componentFn;
    this._scheduler = scheduler;
  }

  afterCommit(): void {
    for (const hook of this._hooks) {
      if (hook.type === EffectType && hook.dirty) {
        hook.cleanup?.();
        hook.cleanup = hook.setup();
        hook.dirty = false;
      }
    }
  }

  beforeRemove(): void {
    for (const hook of this._hooks) {
      if (hook.type === EffectType && hook.cleanup !== undefined) {
        hook.cleanup();
        hook.cleanup = undefined;
      }
    }
  }

  forceUpdate(options: UpdateOptions): UpdateHandle {
    if (this._origin === null) {
      return {
        id: -1,
        lanes: NoLanes,
        finished: Promise.resolve({
          status: 'skipped',
        }),
      };
    }
    return this._scheduler.schedule(new UpdateComponent(this._origin), options);
  }

  inject<TInstance, TDefault = never>(
    type: BoundaryType<TInstance, TDefault>,
  ): TInstance | TDefault {
    let scope: Scope | null = this._origin?.scope ?? null;
    while (scope !== null) {
      for (
        let boundary = scope.boundary;
        boundary !== null;
        boundary = boundary.next
      ) {
        if (boundary.instance instanceof type) {
          return boundary.instance;
        }
      }
      scope = scope.parent;
    }
    if (type.getDefault !== undefined) {
      return type.getDefault();
    }
    throw new ReferenceError(
      `${type.name} could not be resolved in the current component hierarchy.`,
    );
  }

  provide<T extends object>(instance: T): void {
    if (this._origin !== null) {
      this._origin.scope.boundary = {
        instance,
        next: this._origin.scope.boundary,
      };
    }
  }

  render(origin: RenderChild.ComponentChild<TProps>): VElement {
    this._origin = origin;

    try {
      const returnValue = this._componentFn.call(this, origin.props);
      let currentHook = this._hooks[this._hookIndex++];

      if (currentHook !== undefined) {
        ensureHookType(FinalizerType, currentHook);
      } else {
        currentHook = { type: FinalizerType };
        this._hooks.push(currentHook);
        Object.freeze(this._hooks);
      }

      return wrap(returnValue);
    } catch (error) {
      throw new RenderError(
        origin as RenderChild.ComponentChild<any>,
        'An error occurred during rendering.',
      );
    }
  }

  startTransition<T>(callback: (transition: number) => T): T {
    return callback(this._scheduler.nextTransition());
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
        id: this._scheduler.nextIdentifier(),
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

      const { dispatcher, memoizedState, memoizedActions } = currentHook;
      const renderLanes = this._scheduler.flushLanes;
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
                lanes: NoLanes,
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
  function ComponentWrapper(props: TProps): VComponent<TProps> {
    return new VNode(ComponentWrapper, props, []);
  }

  ComponentWrapper.getInstance = (_props: TProps, scheduler: UpdateScheduler) =>
    new Component(componentFn, scheduler);
  ComponentWrapper.arePropsEqual = arePropsEqual;

  DEBUG: {
    Object.defineProperty(Component, 'name', {
      value: componentFn.name,
    });
  }

  return ComponentWrapper;
}

class UpdateComponent implements UpdateUnit {
  private readonly _origin: RenderChild.ComponentChild;

  constructor(origin: RenderChild.ComponentChild) {
    this._origin = origin;
  }

  get scope(): Scope {
    return this._origin.scope;
  }

  prepare(reconciler: Reconciler): () => void {
    const newOrigin: RenderChild.ComponentChild = {
      ...this._origin,
      children: new Array(1),
      scope: createScope(this._origin.scope),
    };
    const returnElement = newOrigin.instance.render(newOrigin);
    newOrigin.children[0] = reconciler.diff(
      this._origin.children[0]!,
      returnElement,
      newOrigin.scope,
    );
    return () => {
      patch(this._origin, newOrigin);
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

function getInitialState<TState>(initialState: InitialState<TState>): TState {
  return typeof initialState === 'function'
    ? (initialState as () => TState)()
    : initialState;
}
