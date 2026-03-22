/// <reference path="../typings/scheduler.d.ts" />

import { LinkedList } from './collections/linked-list.js';

export const $directive: unique symbol = Symbol('$directive');

export const $hook: unique symbol = Symbol('$hook');

export const BOUNDARY_TYPE_ERROR = 0;
export const BOUNDARY_TYPE_HYDRATION = 1;
export const BOUNDARY_TYPE_SHARED_CONTEXT = 2;

export const HOOK_TYPE_FINALIZER = 0;
export const HOOK_TYPE_PASSIVE_EFFECT = 1;
export const HOOK_TYPE_LAYOUT_EFFECT = 2;
export const HOOK_TYPE_INSERTION_EFFECT = 3;
export const HOOK_TYPE_ID = 4;
export const HOOK_TYPE_MEMO = 5;
export const HOOK_TYPE_REDUCER = 6;

export const PART_TYPE_NAMES = [
  'Attribute',
  'ChildNode',
  'Element',
  'Event',
  'Live',
  'Property',
  'Text',
] as const;

export const PART_TYPE_ATTRIBUTE = 0;
export const PART_TYPE_CHILD_NODE = 1;
export const PART_TYPE_ELEMENT = 2;
export const PART_TYPE_EVENT = 3;
export const PART_TYPE_LIVE = 4;
export const PART_TYPE_PROPERTY = 5;
export const PART_TYPE_TEXT = 6;

export const SCOPE_DETACHED: Scope = Object.freeze({
  owner: null,
  level: 0,
  boundary: null,
});

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

export interface Backend {
  flushEffects(effects: EffectQueue, phase: CommitPhase): void;
  getDefaultLanes(): Lanes;
  getUpdatePriority(): TaskPriority;
  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: RequestCallbackOptions,
  ): Promise<T>;
  resolvePrimitive(source: unknown, part: Part): Primitive<unknown>;
  resolveTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    markerIdentifier: string,
    mode: TemplateMode,
  ): DirectiveType<readonly unknown[]>;
  startViewTransition(callback: () => Promise<void> | void): Promise<void>;
  yieldToMain(): Promise<void>;
}

export interface Bindable<T = unknown> {
  [$directive](): Directive<T>;
}

export interface Binding<T> extends ReversibleEffect, SessionLifecycle {
  readonly type: DirectiveType<T>;
  value: T;
  readonly part: Part;
  shouldUpdate(value: T): boolean;
}

export type Boundary =
  | Boundary.ErrorBoundary
  | Boundary.HydrationBoundary
  | Boundary.SharedContextBoundary;

export namespace Boundary {
  export interface ErrorBoundary {
    type: typeof BOUNDARY_TYPE_ERROR;
    next: Boundary | null;
    handler: ErrorHandler;
  }

  export interface HydrationBoundary {
    type: typeof BOUNDARY_TYPE_HYDRATION;
    next: Boundary | null;
    target: TreeWalker;
  }

  export interface SharedContextBoundary {
    type: typeof BOUNDARY_TYPE_SHARED_CONTEXT;
    next: Boundary | null;
    key: unknown;
    value: unknown;
  }
}

export type Cleanup = () => void;

export type CommitPhase = 'mutation' | 'layout' | 'passive';

export interface Component<TProps = {}, TResult = unknown>
  extends DirectiveType<TProps> {
  (props: TProps): Bindable<TProps>;
  render(props: TProps, context: RenderContext): TResult;
  arePropsEqual(nextProps: TProps, prevProps: TProps): boolean;
}

export interface ComponentState {
  hooks: Hook[];
}

export interface Coroutine {
  readonly name: string;
  readonly scope: Scope;
  pendingLanes: Lanes;
  start(session: UpdateSession): void;
  resume(session: UpdateSession): void;
}

export class Directive<T> implements Bindable<T> {
  readonly type: DirectiveType<T>;

  readonly value: T;

  readonly key: unknown;

  constructor(type: DirectiveType<T>, value: T, key?: unknown) {
    this.type = type;
    this.value = value;
    this.key = key;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [$directive](): Directive<T> {
    return this;
  }
}

export interface DirectiveContext {
  resolveDirective<T>(source: T, part: Part): Directive<UnwrapBindable<T>>;
}

export interface DirectiveType<T> {
  readonly name: string;
  equals?(other: DirectiveType<unknown>): boolean;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface DispatchOptions<TState> extends UpdateOptions {
  areStatesEqual?: (nextState: TState, prevState: TState) => boolean;
  transient?: boolean;
}

export interface Effect {
  commit(): void;
}

export interface EffectHandler {
  setup: () => Cleanup | void;
  cleanup: Cleanup | void;
  epoch: number;
}

export class EffectQueue {
  private _headEffects: LinkedList<Effect> = new LinkedList();

  private _middleEffects: LinkedList<Effect> = new LinkedList();

  private _tailEffects: LinkedList<Effect> = new LinkedList();

  private _lastLevel = 0;

  private _size = 0;

  get size(): number {
    return this._size;
  }

  clear(): void {
    this._headEffects.clear();
    this._middleEffects.clear();
    this._tailEffects.clear();
    this._lastLevel = 0;
    this._size = 0;
  }

  flush(): void {
    try {
      for (const effect of this._headEffects) {
        effect.commit();
      }
      for (const effect of this._middleEffects) {
        effect.commit();
      }
      for (const effect of this._tailEffects) {
        effect.commit();
      }
    } finally {
      this.clear();
    }
  }

  push(effect: Effect, level: number): void {
    if (level > this._lastLevel) {
      this._tailEffects = LinkedList.concat(
        this._middleEffects,
        this._tailEffects,
      );
    } else if (level < this._lastLevel) {
      this._headEffects = LinkedList.concat(
        this._headEffects,
        this._middleEffects,
        this._tailEffects,
      );
    }
    this._middleEffects.pushBack(effect);
    this._lastLevel = level;
    this._size++;
  }

  pushAfter(effect: Effect): void {
    this._tailEffects.pushBack(effect);
    this._size++;
  }

  pushBefore(effect: Effect): void {
    this._headEffects.pushBack(effect);
    this._size++;
  }
}

export type ErrorHandler = (
  error: unknown,
  handleError: (error: unknown) => void,
) => void;

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

export type Lane = number;

export type Lanes = number;

export type NextState<T> = (T extends Function ? never : T) | ((state: T) => T);

export type Part =
  | Part.AttributePart
  | Part.ChildNodePart
  | Part.ElementPart
  | Part.EventPart
  | Part.LivePart
  | Part.PropertyPart
  | Part.TextPart;

export namespace Part {
  export interface AttributePart<TElement extends Element = Element> {
    type: typeof PART_TYPE_ATTRIBUTE;
    node: TElement;
    name: string;
  }

  export interface ChildNodePart {
    type: typeof PART_TYPE_CHILD_NODE;
    node: ChildNode;
    sentinelNode: Comment;
    namespaceURI: string | null;
  }

  export interface ElementPart<TElement extends Element = Element> {
    type: typeof PART_TYPE_ELEMENT;
    node: TElement;
  }

  export interface EventPart<TElement extends Element = Element> {
    type: typeof PART_TYPE_EVENT;
    node: TElement;
    name: string;
  }

  export interface LivePart<TElement extends Element = Element> {
    type: typeof PART_TYPE_LIVE;
    node: TElement;
    name: string;
    defaultValue: unknown;
  }

  export interface PropertyPart<TElement extends Element = Element> {
    type: typeof PART_TYPE_PROPERTY;
    node: TElement;
    name: string;
    defaultValue: unknown;
  }

  export interface TextPart {
    type: typeof PART_TYPE_TEXT;
    node: Text;
    precedingText: string;
    followingText: string;
  }
}

export interface Primitive<T> extends DirectiveType<T> {
  ensureValue?(value: unknown, part: Part): asserts value is T;
}

export type ReducerReturn<TState, TAction> = [
  state: TState,
  dispatch: (
    action: TAction,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle,
  isStale: boolean,
];

export type Ref<T> = RefCallback<T> | RefObject<T | null> | null | undefined;

export type RefCallback<T> = (value: T) => Cleanup | void;

export interface RefObject<T> {
  current: T;
}

export interface RenderContext {
  catchError(handler: ErrorHandler): void;
  forceUpdate(options?: UpdateOptions): UpdateHandle;
  getSessionContext(): SessionContext;
  getSharedContext<T>(key: unknown): T | undefined;
  html(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  interrupt(error: unknown): never;
  math(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  setSharedContext<T>(key: unknown, value: T): void;
  startTransition<T>(action: (transition: number) => T): T;
  svg(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  text(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  use<T>(usable: HookClass<T>): T;
  use<T>(usable: HookObject<T>): T;
  use<T>(usable: HookFunction<T>): T;
  useCallback<TCallback extends (...args: any[]) => any>(
    callback: TCallback,
    dependencies: readonly unknown[],
  ): TCallback;
  useEffect(
    setup: () => Cleanup | void,
    dependencies?: readonly unknown[] | null,
  ): void;
  useId(): string;
  useInsertionEffect(
    setup: () => Cleanup | void,
    dependencies?: readonly unknown[] | null,
  ): void;
  useLayoutEffect(
    setup: () => Cleanup | void,
    dependencies?: readonly unknown[] | null,
  ): void;
  useMemo<TResult>(
    computation: () => TResult,
    dependencies: readonly unknown[],
  ): TResult;
  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
  ): ReducerReturn<TState, TAction>;
  useRef<T>(initialValue: T): RefObject<T>;
  useState<TState>(initialState: InitialState<TState>): StateReturn<TState>;
}

export interface RenderFrame {
  id: number;
  lanes: Lanes;
  coroutines: Coroutine[];
  mutationEffects: EffectQueue;
  layoutEffects: EffectQueue;
  passiveEffects: EffectQueue;
}

export type RequestCallbackOptions = SchedulerPostTaskOptions;

export interface ReversibleEffect extends Effect {
  rollback(): void;
}

export interface SessionContext extends DirectiveContext {
  addObserver(observer: SessionObserver): Cleanup;
  getScheduledUpdates(): Update[];
  getTemplate(
    strings: readonly string[],
    args: readonly unknown[],
    mode: TemplateMode,
  ): DirectiveType<readonly unknown[]>;
  startTransition<T>(action: (transition: number) => T): T;
  nextIdentifier(): string;
  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    frame: RenderFrame,
    scope: Scope,
    coroutine: Coroutine,
  ): TResult;
  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateHandle;
}

export type SessionEvent =
  | {
      type: 'render-start' | 'render-end';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'render-error';
      id: number;
      error: unknown;
      captured: boolean;
    }
  | {
      type: 'coroutine-start' | 'coroutine-end';
      id: number;
      coroutine: Coroutine;
    }
  | {
      type: 'commit-start' | 'commit-end';
      id: number;
    }
  | {
      type: 'commit-cancel';
      id: number;
      reason: unknown;
    }
  | {
      type: 'effect-commit-start' | 'effect-commit-end';
      id: number;
      phase: CommitPhase;
      effects: EffectQueue;
    };

export interface SessionLifecycle {
  attach(session: UpdateSession): void;
  detach(session: UpdateSession): void;
}

export interface SessionObserver {
  onSessionEvent(event: SessionEvent): void;
}

export interface Scope {
  owner: Coroutine | null;
  level: number;
  boundary: Boundary | null;
}

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

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export type UnwrapBindable<T> = T extends Bindable<infer Value> ? Value : T;

export interface Update {
  id: number;
  lanes: Lanes;
  coroutine: Coroutine;
  controller: PromiseWithResolvers<UpdateResult>;
}

export interface UpdateHandle {
  id: number;
  lanes: Lanes;
  scheduled: Promise<UpdateResult>;
  finished: Promise<UpdateResult>;
}

export interface UpdateOptions extends SchedulerPostTaskOptions {
  flushSync?: boolean;
  immediate?: boolean;
  transition?: number;
  triggerFlush?: boolean;
  viewTransition?: boolean;
}

export type UpdateResult =
  | { status: 'done' }
  | { status: 'skipped' }
  | { status: 'canceled'; reason: unknown };

export interface UpdateSession {
  frame: RenderFrame;
  scope: Scope;
  coroutine: Coroutine;
  context: SessionContext;
}

export type Usable<T> = HookClass<T> | HookObject<T> | HookFunction<T>;

export function areDirectiveTypesEqual(
  nextType: DirectiveType<unknown>,
  prevType: DirectiveType<unknown>,
): boolean {
  return nextType.equals?.(prevType) ?? nextType === prevType;
}

export function isBindable(value: unknown): value is Bindable<any> {
  return typeof (value as Bindable)?.[$directive] === 'function';
}
