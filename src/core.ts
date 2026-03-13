/// <reference path="../typings/scheduler.d.ts" />

import { LinkedList } from './collections/linked-list.js';

export const $directive: unique symbol = Symbol('$directive');

export const $hook: unique symbol = Symbol('$hook');

export const DETACHED_SCOPE: Scope = Object.freeze(createScope());

export interface Backend {
  flushEffects(effects: EffectQueue, phase: CommitPhase): void;
  getDefaultLanes(): Lanes;
  getUpdatePriority(): TaskPriority;
  parseTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    markerIdentifier: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: RequestCallbackOptions,
  ): Promise<T>;
  resolveLayout(source: unknown, part: Part): Layout;
  resolvePrimitive(source: unknown, part: Part): Primitive<unknown>;
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
    type: typeof BoundaryType.Error;
    next: Boundary | null;
    handler: ErrorHandler;
  }

  export interface HydrationBoundary {
    type: typeof BoundaryType.Hydration;
    next: Boundary | null;
    targetTree: TreeWalker;
  }

  export interface SharedContextBoundary {
    type: typeof BoundaryType.SharedContext;
    next: Boundary | null;
    key: unknown;
    value: unknown;
  }
}

export const BoundaryType = {
  Error: 0,
  Hydration: 1,
  SharedContext: 2,
} as const;

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
  resume(session: UpdateSession): void;
}

export interface Directive<T> {
  type?: DirectiveType<T>;
  value: T;
  layout?: Layout;
  defaultLayout?: Layout;
}

export interface DirectiveContext {
  resolveDirective<T>(
    source: T,
    part: Part,
  ): Required<Directive<UnwrapBindable<T>>>;
  resolveSlot<T>(source: T, part: Part): Slot<T>;
}

export interface DirectiveType<T> {
  readonly name: string;
  equals?(other: DirectiveType<unknown>): boolean;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface DispatchOptions<T> extends UpdateOptions {
  areStatesEqual?: (nextState: T, prevState: T) => boolean;
}

export interface Effect {
  commit(): void;
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
    for (const effect of this._headEffects) {
      effect.commit();
    }
    for (const effect of this._middleEffects) {
      effect.commit();
    }
    for (const effect of this._tailEffects) {
      effect.commit();
    }
    this.clear();
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
    type: typeof HookType.Finalizer;
  }

  export interface EffectHook {
    type:
      | typeof HookType.PassiveEffect
      | typeof HookType.LayoutEffect
      | typeof HookType.InsertionEffect;
    callback: () => Cleanup | void;
    cleanup: Cleanup | void;
    epoch: number;
    memoizedDependencies: readonly unknown[] | null;
    pendingDependencies: readonly unknown[] | null;
  }

  export interface IdHook {
    type: typeof HookType.Id;
    id: string;
  }

  export interface MemoHook<TResult> {
    type: typeof HookType.Memo;
    value: TResult;
    dependencies: readonly unknown[] | null;
  }

  export interface ReducerHook<TState, TAction> {
    type: typeof HookType.Reducer;
    reducer: (state: TState, action: TAction) => TState;
    dispatch: (action: TAction) => UpdateHandle;
    pendingLanes: Lanes;
    pendingState: TState;
    memoizedState: TState;
    context: RenderContext;
  }
}

/**
 * Represents a class with a static [$hook] method. never[] and NoInfer<T>
 * ensure T is inferred solely from the constructor.
 */
export interface HookClass<T> {
  new (...args: never[]): T;
  [$hook](context: RenderContext): NoInfer<T>;
}

export type HookFunction<T> = (context: RenderContext) => T;

export interface HookObject<T> {
  [$hook](context: RenderContext): T;
}

export const HookType = {
  Finalizer: 0,
  PassiveEffect: 1,
  LayoutEffect: 2,
  InsertionEffect: 3,
  Id: 4,
  Memo: 5,
  Reducer: 6,
} as const;

export type HookType = (typeof HookType)[keyof typeof HookType];

export type InitialState<T> = (T extends Function ? never : T) | (() => T);

// biome-ignore format: Align Lane flags
export const Lane = {
  NoLane:             0,
  ConcurrentLane:     0b1,
  SyncLane:           0b10,
  UserBlockingLane:   0b100,
  UserVisibleLane:    0b1000,
  BackgroundLane:     0b10000,
  TransitionLane:     0b100000,
  ViewTransitionLane: 0b1000000,
} as const satisfies Record<string, Lanes>;

export type Lanes = number;

export interface Layout {
  readonly name: string;
  compose(other: Layout): Layout;
  placeBinding<T>(
    binding: Binding<UnwrapBindable<T>>,
    defaultLayout: Layout,
  ): Slot<T>;
}

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
  export interface AttributePart {
    type: typeof PartType.Attribute;
    node: Element;
    name: string;
  }

  export interface ChildNodePart {
    type: typeof PartType.ChildNode;
    node: Comment;
    anchorNode: ChildNode | null;
    namespaceURI: string | null;
  }

  export interface ElementPart {
    type: typeof PartType.Element;
    node: Element;
  }

  export interface EventPart {
    type: typeof PartType.Event;
    node: Element;
    name: string;
  }

  export interface LivePart {
    type: typeof PartType.Live;
    node: Element;
    name: string;
    defaultValue: unknown;
  }

  export interface PropertyPart {
    type: typeof PartType.Property;
    node: Element;
    name: string;
    defaultValue: unknown;
  }

  export interface TextPart {
    type: typeof PartType.Text;
    node: Text;
    precedingText: string;
    followingText: string;
  }
}

export const PartType = {
  Attribute: 0,
  ChildNode: 1,
  Element: 2,
  Event: 3,
  Live: 4,
  Property: 5,
  Text: 6,
} as const;

export type PartType = (typeof PartType)[keyof typeof PartType];

export interface Primitive<T> extends DirectiveType<T> {
  ensureValue?(value: unknown, part: Part): asserts value is T;
}

export type ReducerController<TState, TAction> = [
  state: TState,
  dispatch: (
    action: TAction,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle,
  isPending: boolean,
];

export type Ref<T> = RefCallback<T> | RefObject<T | null> | null | undefined;

export type RefCallback<T> = (value: T) => Cleanup | void;

export interface RefObject<T> {
  current: T;
}

export interface RenderContext {
  catchError(handler: ErrorHandler): void;
  forceUpdate(options?: UpdateOptions): UpdateHandle;
  getInsideUpdate(): Update | null;
  getOutsideUpdate(): Update | null;
  getSessionContext(): SessionContext;
  getSharedContext<T>(key: unknown): T | undefined;
  html(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  math(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  setSharedContext<T>(key: unknown, value: T): void;
  startTransition(action: TransitionAction): TransitionHandle;
  svg(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  text(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  throwError(error: unknown): void;
  use<T>(usable: HookClass<T>): T;
  use<T>(usable: HookObject<T>): T;
  use<T>(usable: HookFunction<T>): T;
  useCallback<TCallback extends (...args: any[]) => any>(
    callback: TCallback,
    dependencies: readonly unknown[],
  ): TCallback;
  useEffect(
    callback: () => Cleanup | void,
    dependencies?: readonly unknown[] | null,
  ): void;
  useId(): string;
  useInsertionEffect(
    callback: () => Cleanup | void,
    dependencies?: readonly unknown[] | null,
  ): void;
  useLayoutEffect(
    callback: () => Cleanup | void,
    dependencies?: readonly unknown[] | null,
  ): void;
  useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;
  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
  ): ReducerController<TState, TAction>;
  useRef<T>(initialValue: T): RefObject<T>;
  useState<TState>(initialState: InitialState<TState>): StateController<TState>;
}

export interface RenderFrame {
  id: number;
  lanes: Lanes;
  pendingCoroutines: Coroutine[];
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
  nextIdentifier(): string;
  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    state: ComponentState,
    frame: RenderFrame,
    scope: Scope,
    coroutine: Coroutine,
  ): TResult;
  resolveTemplate(
    strings: readonly string[],
    args: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateHandle;
  startTransition(action: TransitionAction): TransitionHandle;
}

export type SessionEvent =
  | {
      type: 'update-start';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'update-success';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'update-failure';
      id: number;
      lanes: Lanes;
      error: unknown;
    }
  | {
      type: 'render-start' | 'render-end';
      id: number;
    }
  | {
      type: 'render-error';
      id: number;
      error: unknown;
      captured: boolean;
    }
  | {
      type: 'component-render-start' | 'component-render-end';
      id: number;
      component: Component<any>;
      props: unknown;
      context: RenderContext;
    }
  | {
      type: 'commit-start' | 'commit-end';
      id: number;
      mutationEffects: EffectQueue;
      layoutEffects: EffectQueue;
      passiveEffects: EffectQueue;
    }
  | {
      type: 'effect-commit-start' | 'effect-commit-end';
      id: number;
      effects: EffectQueue;
      phase: CommitPhase;
    };

export interface SessionLifecycle {
  attach(session: UpdateSession): void;
  detach(session: UpdateSession): void;
}

export interface SessionObserver {
  onSessionEvent(event: SessionEvent): void;
}

export interface Scope {
  parent: Scope | null;
  owner: Coroutine | null;
  level: number;
  boundary: Boundary | null;
}

export interface Slot<T> extends ReversibleEffect, SessionLifecycle {
  readonly type: DirectiveType<UnwrapBindable<T>>;
  readonly value: UnwrapBindable<T>;
  readonly part: Part;
  reconcile(source: T, session: UpdateSession): boolean;
}

export type StateController<TState> = [
  state: TState,
  setState: (
    nextState: NextState<TState>,
    options?: DispatchOptions<TState>,
  ) => UpdateHandle,
  isPending: boolean,
];

export interface Template<TValues extends readonly unknown[]>
  extends DirectiveType<TValues> {
  readonly arity: TValues['length'];
  render(
    values: TValues,
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult;
  hydrate(
    values: TValues,
    part: Part.ChildNodePart,
    targetTree: TreeWalker,
    session: UpdateSession,
  ): TemplateResult;
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export interface TemplateResult {
  children: readonly ChildNode[];
  slots: Slot<unknown>[];
}

export interface Transition {
  signal: AbortSignal;
  suspends: Promise<unknown>[];
  resumes: Promise<unknown>[];
}

export type TransitionAction = (transition: Transition) => Promise<void> | void;

export interface TransitionHandle {
  signal: AbortSignal;
  ready: Promise<void>;
  finished: Promise<TransitionResult>;
}

export type TransitionResult =
  | { status: 'done' }
  | { status: 'canceled'; reason: unknown };

export type UnwrapBindable<T> = T extends Bindable<infer Value> ? Value : T;

export interface Update {
  id: number;
  lanes: Lanes;
  coroutine: Coroutine;
  controller: PromiseWithResolvers<UpdateResult>;
  transition: Transition | null;
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
  transition?: Transition;
  triggerFlush?: boolean;
  viewTransition?: boolean;
}

export type UpdateResult =
  | { status: 'done' }
  | { status: 'skipped' }
  | { status: 'canceled'; reason: unknown };

export interface UpdateSession {
  readonly frame: RenderFrame;
  readonly scope: Scope;
  readonly coroutine: Coroutine;
  readonly context: SessionContext;
}

export type Usable<T> = HookClass<T> | HookObject<T> | HookFunction<T>;

/**
 * @internal
 */
export function createScope(
  parent: Scope | null = null,
  owner: Coroutine | null = null,
): Scope {
  return {
    parent,
    owner,
    level: parent !== null ? parent.level + 1 : 0,
    boundary: null,
  };
}

/**
 * @internal
 */
export function createUpdateSession(
  frame: RenderFrame,
  scope: Scope,
  coroutine: Coroutine,
  context: SessionContext,
): UpdateSession {
  return {
    frame,
    scope,
    coroutine,
    context,
  };
}

/**
 * @internal
 */
export function getLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes = Lane.NoLane;

  if (options.flushSync) {
    lanes |= Lane.SyncLane;
  }

  switch (options.priority) {
    case 'user-blocking':
      lanes |= Lane.UserBlockingLane;
      break;
    case 'user-visible':
      lanes |= Lane.UserVisibleLane;
      break;
    case 'background':
      lanes |= Lane.BackgroundLane;
      break;
  }

  if (options.transition !== undefined) {
    lanes |= Lane.TransitionLane;
  }

  if (options.viewTransition) {
    lanes |= Lane.ViewTransitionLane;
  }

  return lanes;
}

/**
 * @internal
 */
export function getPriorityFromLanes(lanes: Lanes): TaskPriority | null {
  if (lanes & Lane.BackgroundLane) {
    return 'background';
  } else if (lanes & Lane.UserVisibleLane) {
    return 'user-visible';
  } else if (lanes & Lane.UserBlockingLane) {
    return 'user-blocking';
  } else {
    return null;
  }
}

/**
 * @internal
 */
export function getStartNode(part: Part): ChildNode {
  return part.type === PartType.ChildNode
    ? (part.anchorNode ?? part.node)
    : part.node;
}
