/// <reference path="../typings/scheduler.d.ts" />

export const $directive: unique symbol = Symbol('$directive');

export const $hook: unique symbol = Symbol('$hook');

export const DETACHED_SCOPE: Scope = Object.freeze(createScope());

export interface Bindable<T = unknown> {
  [$directive](): Partial<Directive<T>>;
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

export const CommitPhase = {
  Mutation: 0,
  Layout: 1,
  Passive: 2,
} as const;

export type CommitPhase = (typeof CommitPhase)[keyof typeof CommitPhase];

export interface Component<TProps, TResult = unknown>
  extends DirectiveType<TProps> {
  (props: TProps): Bindable<TProps>;
  render(props: TProps, context: RenderContext): TResult;
  arePropsEqual(nextProps: TProps, prevProps: TProps): boolean;
}

export interface ComponentState {
  hooks: Hook[];
  pendingLanes: Lanes;
  scope: Scope;
}

export interface Coroutine {
  readonly name: string;
  readonly pendingLanes: Lanes;
  readonly scope: Scope;
  resume(session: UpdateSession): void;
}

export interface Directive<T> {
  type: DirectiveType<T>;
  value: T;
  layout: Layout;
  defaultLayout: Layout;
}

export interface DirectiveContext {
  resolveDirective<T>(source: T, part: Part): Directive<UnwrapBindable<T>>;
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
  private _headEffects: Effect[] = [];

  private _middleEffects: Effect[] = [];

  private _tailEffects: Effect[] = [];

  private _lastLevel = 0;

  get length(): number {
    return (
      this._headEffects.length +
      this._middleEffects.length +
      this._tailEffects.length
    );
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
    this._headEffects = [];
    this._middleEffects = [];
    this._tailEffects = [];
    this._lastLevel = 0;
  }

  push(effect: Effect, level: number): void {
    if (level > this._lastLevel) {
      this._middleEffects.push(...this._tailEffects);
      this._tailEffects = this._middleEffects;
      this._middleEffects = [effect];
    } else if (level < this._lastLevel) {
      this._headEffects.push(...this._middleEffects, ...this._tailEffects);
      this._middleEffects = [effect];
      this._tailEffects = [];
    } else {
      this._middleEffects.push(effect);
    }
    this._lastLevel = level;
  }

  pushAfter(effect: Effect): void {
    this._tailEffects.push(effect);
  }

  pushBefore(effect: Effect): void {
    this._headEffects.push(effect);
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
  }
}

/**
 * Represents a class with a static `[$hook]` method. `NoInfer<T>` ensures `T`
 * is inferred from the constructor only.
 */
export interface HookClass<T> {
  new (...args: any[]): T;
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
  DefaultLane:        0b1,
  UserBlockingLane:   0b10,
  UserVisibleLane:    0b100,
  BackgroundLane:     0b1000,
  SyncLane:           0b10000,
  ViewTransitionLane: 0b100000,
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

export type NextState<T> =
  | (T extends Function ? never : T)
  | ((prevState: T) => T);

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

export type Ref<T> = RefCallback<T> | RefObject<T | null> | null | undefined;

export type RefCallback<T> = (value: T) => Cleanup | void;

export interface RefObject<T> {
  current: T;
}

export interface RenderContext {
  catchError(handler: ErrorHandler): void;
  forceUpdate(options?: UpdateOptions): UpdateHandle;
  getSessionContext(): SessionContext;
  getSharedContext(key: unknown): unknown;
  html(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  isUpdatePending(): boolean;
  math(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  setSharedContext(key: unknown, value: unknown): void;
  svg(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  text(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  use<T extends Usable<any>>(usable: T): Use<T>;
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
  ): [
    state: TState,
    dispatch: (
      action: TAction,
      options?: DispatchOptions<TState>,
    ) => UpdateHandle,
    isPending: boolean,
  ];
  useRef<T>(initialValue: T): RefObject<T>;
  useState<TState>(
    initialState: InitialState<TState>,
  ): [
    state: TState,
    setState: (
      nextState: NextState<TState>,
      options?: DispatchOptions<TState>,
    ) => UpdateHandle,
    isPending: boolean,
  ];
  waitForUpdate(): Promise<number>;
}

export interface RenderFrame {
  id: number;
  lanes: Lanes;
  pendingCoroutines: Coroutine[];
  mutationEffects: EffectQueue;
  layoutEffects: EffectQueue;
  passiveEffects: EffectQueue;
}

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}

export interface ReversibleEffect extends Effect {
  rollback(): void;
}

export interface SessionContext extends DirectiveContext {
  getPendingUpdates(): IteratorObject<UpdateTask>;
  nextIdentifier(): string;
  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    state: ComponentState,
    coroutine: Coroutine,
    frame: RenderFrame,
    scope: Scope,
  ): TResult;
  resolveTemplate(
    strings: readonly string[],
    args: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateHandle;
}

export interface SessionLifecycle {
  attach(session: UpdateSession): void;
  detach(session: UpdateSession): void;
}

export interface Scope {
  parent: Scope | null;
  context: ScopeContext | null;
  level: number;
  boundary: Boundary | null;
}

export interface ScopeContext extends Coroutine, SessionLifecycle {}

export interface Slot<T> extends ReversibleEffect, SessionLifecycle {
  readonly type: DirectiveType<UnwrapBindable<T>>;
  readonly value: UnwrapBindable<T>;
  readonly part: Part;
  reconcile(source: T, session: UpdateSession): boolean;
}

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

export type UnwrapBindable<T> = T extends Bindable<infer Value> ? Value : T;

export interface UpdateHandle {
  lanes: Lanes;
  scheduled: Promise<UpdateResult>;
  finished: Promise<UpdateResult>;
}

export interface UpdateOptions {
  flushSync?: boolean;
  immediate?: boolean;
  priority?: TaskPriority;
  triggerFlush?: boolean;
  viewTransition?: boolean;
}

export interface UpdateResult {
  canceled: boolean;
  done: boolean;
}

export interface UpdateSession {
  readonly frame: RenderFrame;
  readonly scope: Scope;
  readonly originScope: Scope;
  readonly context: SessionContext;
}

export interface UpdateTask {
  coroutine: Coroutine;
  lanes: Lanes;
  continuation: PromiseWithResolvers<UpdateResult>;
}

export type Usable<T> = HookClass<T> | HookObject<T> | HookFunction<T>;

export type Use<T> =
  T extends HookClass<infer Result>
    ? Result
    : T extends HookObject<infer Result>
      ? Result
      : T extends HookFunction<infer Result>
        ? Result
        : never;

/**
 * @internal
 */
export function areDirectiveTypesEqual(
  nextType: DirectiveType<unknown>,
  prevType: DirectiveType<unknown>,
): boolean {
  return nextType.equals?.(prevType) ?? nextType === prevType;
}

/**
 * @internal
 */
export function createScope(
  parent: Scope | null = null,
  context: ScopeContext | null = null,
): Scope {
  return {
    parent,
    context,
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
  originScope: Scope,
  context: SessionContext,
): UpdateSession {
  return {
    frame,
    scope,
    originScope,
    context,
  };
}

/**
 * @internal
 */
export function getHydrationTargetTree(scope: Scope): TreeWalker | null {
  for (
    let boundary = scope.boundary;
    boundary !== null;
    boundary = boundary.next
  ) {
    if (boundary.type === BoundaryType.Hydration) {
      return boundary.targetTree;
    }
  }
  return null;
}

/**
 * @internal
 */
export function getLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes = Lane.DefaultLane;

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

  if (options.flushSync) {
    lanes |= Lane.SyncLane;
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

/**
 * @internal
 */
export function isBindable(value: unknown): value is Bindable<any> {
  return typeof (value as Bindable)?.[$directive] === 'function';
}

/**
 * @internal
 */
export function toDirective<T>(
  source: T,
): Partial<Directive<UnwrapBindable<T>>> {
  return isBindable(source)
    ? source[$directive]()
    : { value: source as UnwrapBindable<T> };
}
