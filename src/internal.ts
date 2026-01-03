/// <reference path="../typings/scheduler.d.ts" />

import type { Literal, TemplateLiteral } from './template-literal.js';

export const $hook: unique symbol = Symbol('$hook');

export const $toDirective: unique symbol = Symbol('$toDirective');

export interface Bindable<T = unknown> {
  [$toDirective](part: Part, context: DirectiveContext): Directive<T>;
}

export interface Binding<T> extends ReversibleEffect {
  readonly type: DirectiveType<T>;
  value: T;
  readonly part: Part;
  shouldUpdate(value: T): boolean;
  attach(session: UpdateSession): void;
  detach(session: UpdateSession): void;
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
    treeWalker: TreeWalker;
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
}

export interface Coroutine {
  readonly scope: Scope;
  readonly pendingLanes: Lanes;
  resume(session: UpdateSession): void;
}

export interface Directive<T> {
  type: DirectiveType<T>;
  value: T;
  layout?: Layout;
}

export interface DirectiveContext {
  resolveDirective<T>(value: T, part: Part): Directive<UnwrapBindable<T>>;
  resolveSlot<T>(value: T, part: Part): Slot<T>;
}

export interface DirectiveType<T> {
  displayName: string;
  equals?(other: DirectiveType<unknown>): boolean;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface DispatchOptions<T> extends UpdateOptions {
  areStatesEqual?: (x: T, y: T) => boolean;
}

export interface Effect {
  commit(): void;
}

export type ErrorHandler = (
  error: unknown,
  handle: (erorr: unknown) => void,
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
    pendingDependencies: readonly unknown[] | null;
    memoizedDependencies: readonly unknown[] | null;
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

export type InitialState<T> = [T] extends [Function] ? () => T : (() => T) | T;

// biome-ignore format: Align lane flags
export const Lanes = {
  NoLanes:            0,
  AllLanes:           -1,
  DefaultLane:        0b1,
  ViewTransitionLane: 0b10,
  UserBlockingLane:   0b100,
  UserVisibleLane:    0b1000,
  BackgroundLane:     0b10000,
} as const satisfies Record<string, Lanes>;

export type Lanes = number;

export interface Layout {
  displayName: string;
  resolveSlot<T>(binding: Binding<UnwrapBindable<T>>): Slot<T>;
}

export type NewState<T> = [T] extends [Function]
  ? (prevState: T) => T
  : ((prevState: T) => T) | T;

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

export type Ref<T> = RefCallback<T> | RefObject<T | null> | null;

export type RefCallback<T> = (value: T) => Cleanup | void;

export interface RefObject<T> {
  current: T;
}

export interface RenderContext {
  catchError(handler: ErrorHandler): void;
  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  forceUpdate(options?: UpdateOptions): UpdateHandle;
  getSessionContext(): SessionContext;
  getSharedContext(key: unknown): unknown;
  html(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  isUpdatePending(): boolean;
  math(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  setSharedContext(key: unknown, value: unknown): void;
  svg(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  text(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  use<T>(usable: Usable<T>): T;
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
      newState: NewState<TState>,
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
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}

export interface ReversibleEffect extends Effect {
  rollback(): void;
}

export interface SessionContext extends DirectiveContext {
  getPendingTasks(): UpdateTask[];
  expandLiterals<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T>;
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
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateHandle;
}

export interface Slot<T> extends ReversibleEffect {
  readonly type: DirectiveType<UnwrapBindable<T>>;
  readonly value: UnwrapBindable<T>;
  readonly part: Part;
  reconcile(value: T, session: UpdateSession): boolean;
  attach(session: UpdateSession): void;
  detach(session: UpdateSession): void;
}

export interface Template<TBinds extends readonly unknown[]>
  extends DirectiveType<TBinds> {
  readonly arity: TBinds['length'];
  render(
    binds: TBinds,
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult;
  hydrate(
    binds: TBinds,
    part: Part.ChildNodePart,
    treeWalker: TreeWalker,
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
  flush?: boolean;
  immediate?: boolean;
  priority?: TaskPriority;
  viewTransition?: boolean;
}

export interface UpdateResult {
  canceled: boolean;
  done: boolean;
}

export interface UpdateSession {
  readonly frame: RenderFrame;
  readonly scope: Scope;
  readonly rootScope: Scope;
  readonly context: SessionContext;
}

export interface UpdateTask {
  coroutine: Coroutine;
  lanes: Lanes;
  continuation: PromiseWithResolvers<UpdateResult>;
}

export type Usable<T> = HookFunction<T> | HookObject<T>;

export class Scope {
  static readonly DETACHED: Scope = Object.freeze(new Scope()) as Scope;

  private readonly _parent: Scope | null;

  private _boundary: Boundary | null = null;

  constructor(parent: Scope | null = null) {
    this._parent = parent;
  }

  addErrorHandler(handler: ErrorHandler): void {
    this._boundary = {
      type: BoundaryType.Error,
      next: this._boundary,
      handler,
    };
  }

  getHydrationTreeWalker(): TreeWalker | null {
    for (
      let boundary = this._boundary;
      boundary !== null;
      boundary = boundary.next
    ) {
      if (boundary.type === BoundaryType.Hydration) {
        return boundary.treeWalker;
      }
    }
    return null;
  }

  getSharedContext(key: unknown): unknown {
    let currentScope: Scope | null = this;
    do {
      for (
        let boundary = currentScope._boundary;
        boundary !== null;
        boundary = boundary.next
      ) {
        if (
          boundary.type === BoundaryType.SharedContext &&
          Object.is(boundary.key, key)
        ) {
          return boundary.value;
        }
      }
      currentScope = currentScope._parent;
    } while (currentScope !== null);
    return undefined;
  }

  handleError(error: unknown): void {
    let currentScope: Scope = this;
    let currentBoundary = this._boundary;

    const handle = (error: unknown) => {
      while (true) {
        while (currentBoundary !== null) {
          const boundary = currentBoundary;
          currentBoundary = currentBoundary.next;
          if (boundary.type === BoundaryType.Error) {
            const { handler } = boundary;
            handler(error, handle);
            return;
          }
        }
        const parentScope = currentScope._parent;
        if (parentScope === null) {
          throw error;
        }
        currentScope = parentScope;
        currentBoundary = parentScope._boundary;
      }
    };

    handle(error);
  }

  setHydrationTreeWalker(treeWalker: TreeWalker): void {
    this._boundary = {
      type: BoundaryType.Hydration,
      next: this._boundary,
      treeWalker,
    };
  }

  setSharedContext(key: unknown, value: unknown): void {
    this._boundary = {
      type: BoundaryType.SharedContext,
      next: this._boundary,
      key,
      value,
    };
  }
}

/**
 * @internal
 */
export function createUpdateSession(
  frame: RenderFrame,
  scope: Scope,
  rootScope: Scope,
  context: SessionContext,
): UpdateSession {
  return {
    frame,
    scope,
    rootScope,
    context,
  };
}

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
export function getLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes = Lanes.DefaultLane;

  switch (options.priority) {
    case 'user-blocking':
      lanes |= Lanes.UserBlockingLane;
      break;
    case 'user-visible':
      lanes |= Lanes.UserVisibleLane;
      break;
    case 'background':
      lanes |= Lanes.BackgroundLane;
      break;
  }

  if (options.viewTransition) {
    lanes |= Lanes.ViewTransitionLane;
  }

  return lanes;
}

/**
 * @internal
 */
export function getPriorityFromLanes(lanes: Lanes): TaskPriority | null {
  if (lanes & Lanes.BackgroundLane) {
    return 'background';
  } else if (lanes & Lanes.UserVisibleLane) {
    return 'user-visible';
  } else if (lanes & Lanes.UserBlockingLane) {
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
export function isBindable(value: unknown): value is Bindable {
  return typeof (value as Bindable<unknown>)?.[$toDirective] === 'function';
}
