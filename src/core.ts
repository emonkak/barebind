/// <reference path="../typings/moveBefore.d.ts" />
/// <reference path="../typings/scheduler.d.ts" />

export const $toDirective: unique symbol = Symbol('$toDirective');

export interface Bindable<T = unknown> {
  [$toDirective](part: Part, context: DirectiveContext): Directive<T>;
}

export interface Binding<T> extends ReversibleEffect {
  readonly type: DirectiveType<T>;
  readonly value: T;
  readonly part: Part;
  shouldBind(value: T): boolean;
  bind(value: T): void;
  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export interface CommitContext {
  debugValue(type: DirectiveType<unknown>, value: unknown, part: Part): void;
  undebugValue(type: DirectiveType<unknown>, value: unknown, part: Part): void;
}

export const CommitPhase = {
  Mutation: 0,
  Layout: 1,
  Passive: 2,
} as const;

export type CommitPhase = (typeof CommitPhase)[keyof typeof CommitPhase];

export interface Component<TProps, TResult> extends DirectiveType<TProps> {
  render(props: TProps, context: RenderContext): TResult;
  shouldSkipUpdate(nextProps: TProps, prevProps: TProps): boolean;
}

export interface ComponentFunction<TProps, TResult = unknown> {
  (props: TProps, context: RenderContext): TResult;
  shouldSkipUpdate?(nextProps: TProps, prevProps: TProps): boolean;
}

export interface ComponentResult<T> {
  value: T;
  pendingLanes: Lanes;
}

export interface Coroutine extends Effect {
  resume(lanes: Lanes, context: UpdateContext): Lanes;
}

export interface CustomHook<T> {
  onCustomHook(context: HookContext): T;
}

export interface Directive<T> {
  readonly type: DirectiveType<T>;
  readonly value: T;
  readonly slotType?: SlotType;
}

export interface DirectiveContext {
  resolveDirective<T>(value: T, part: Part): Directive<unknown>;
  resolveSlot<T>(value: T, part: Part): Slot<T>;
}

export interface DirectiveType<T> {
  readonly name: string;
  equals?(other: DirectiveType<unknown>): boolean;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface Effect {
  commit(context: CommitContext): void;
}

export type HydrationNode<T extends number> =
  T extends keyof HydrationNodeTypeMap
    ? HydrationNodeTypeMap[T]
    : HydrationNodeTypeMap[keyof HydrationNodeTypeMap];

export interface HydrationTree {
  peekNode<T extends number>(
    expectedType: T,
    expectedName: string,
  ): HydrationNode<T>;
  popNode<T extends number>(
    expectedType: T,
    expectedName: string,
  ): HydrationNode<T>;
  splitText(): this;
}

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
      | typeof HookType.Effect
      | typeof HookType.LayoutEffect
      | typeof HookType.InsertionEffect;
    callback: () => (() => void) | void;
    cleanup: (() => void) | void;
    dependencies: unknown[] | null;
  }

  export interface IdHook {
    type: typeof HookType.Id;
    id: string;
  }

  export interface MemoHook<TResult> {
    type: typeof HookType.Memo;
    value: TResult;
    dependencies: unknown[] | null;
  }

  export interface ReducerHook<TState, TAction> {
    type: typeof HookType.Reducer;
    lanes: Lanes;
    reducer: (state: TState, action: TAction) => TState;
    pendingState: TState;
    memoizedState: TState;
    dispatch: (action: TAction) => void;
  }
}

export interface HookContext {
  forceUpdate(options?: UpdateOptions): UpdateTask;
  getContextValue(key: unknown): unknown;
  setContextValue(key: unknown, value: unknown): void;
  use<T>(hook: CustomHook<T>): T;
  useCallback<T extends Function>(callback: T, dependencies: unknown[]): T;
  useDeferredValue<T>(value: T, initialValue?: InitialState<T>): T;
  useEffect(
    callback: () => (() => void) | void,
    dependencies: unknown[] | null,
  ): void;
  useId(): string;
  useInsertionEffect(
    callback: () => (() => void) | void,
    dependencies: unknown[] | null,
  ): void;
  useLayoutEffect(
    callback: () => (() => void) | void,
    dependencies: unknown[] | null,
  ): void;
  useMemo<T>(factory: () => T, dependencies: unknown[]): T;
  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
  ): [
    state: TState,
    dispatch: (action: TAction, options?: UpdateOptions) => void,
    isPending: boolean,
  ];
  useRef<T>(initialValue: T): RefObject<T>;
  useState<TState>(
    initialState: InitialState<TState>,
  ): [
    state: TState,
    setState: (newState: NewState<TState>, options?: UpdateOptions) => void,
    isPending: boolean,
  ];
  useSyncEnternalStore<T>(
    subscribe: (subscriber: () => void) => (() => void) | void,
    getSnapshot: () => T,
  ): T;
}

export const HookType = {
  Finalizer: 0,
  Effect: 1,
  LayoutEffect: 2,
  InsertionEffect: 3,
  Id: 4,
  Memo: 5,
  Reducer: 6,
} as const;

export type HookType = (typeof HookType)[keyof typeof HookType];

export type InitialState<T> = [T] extends [Function] ? () => T : (() => T) | T;

export const Lanes = {
  NoLanes: 0b0,
  UserBlockingLane: 0b1,
  UserVisibleLane: 0b10,
  BackgroundLane: 0b100,
  ViewTransitionLane: 0b1000,
  DefaultLanes: 0b111,
  AllLanes: -1,
} as const;

export type Lanes = number;

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
    childNode: ChildNode | null;
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

export interface RefObject<T> {
  current: T;
}

export interface RenderContext extends HookContext {
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
  html(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  math(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  svg(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
  text(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): Bindable<readonly unknown[]>;
}

export interface RenderSessionContext {
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  expandLiterals<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T>;
  flushSync(): void;
  getScope(): Scope;
  nextIdentifier(): string;
  resolveTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateTask;
  waitForUpdate(coroutine: Coroutine): Promise<number>;
}

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}

export interface ReversibleEffect extends Effect {
  rollback(context: CommitContext): void;
}

export interface Slot<T> extends ReversibleEffect {
  readonly type: DirectiveType<unknown>;
  readonly value: unknown;
  readonly part: Part;
  reconcile(value: T, context: UpdateContext): void;
  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export interface SlotType {
  new <T>(binding: Binding<unknown>): Slot<T>;
}

export interface Template<TBinds extends readonly unknown[]>
  extends DirectiveType<TBinds> {
  readonly arity: TBinds['length'];
  render(
    binds: TBinds,
    part: Part.ChildNodePart,
    context: UpdateContext,
  ): TemplateResult;
  hydrate(
    binds: TBinds,
    part: Part.ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateResult;
}

export interface TemplateLiteral<T> {
  strings: readonly string[];
  values: T[];
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export interface TemplateResult {
  readonly childNodes: readonly ChildNode[];
  readonly slots: Slot<unknown>[];
}

export interface UpdateContext extends DirectiveContext, RenderSessionContext {
  enqueueCoroutine(coroutine: Coroutine): void;
  enterScope(scope: Scope): UpdateContext;
  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    lanes: Lanes,
    coroutine: Coroutine,
  ): ComponentResult<TResult>;
}

export interface UpdateOptions {
  priority?: TaskPriority;
  viewTransition?: boolean;
}

export interface UpdateTask {
  lanes: Lanes;
  promise: Promise<void>;
}

interface HydrationNodeTypeMap {
  [Node.ELEMENT_NODE]: Element;
  [Node.TEXT_NODE]: Text;
  [Node.COMMENT_NODE]: Comment;
}

interface ScopeEntry {
  key: unknown;
  value: unknown;
}

export class Literal extends String {}

export class Scope {
  private readonly _parent: Scope | null;

  private readonly _entries: ScopeEntry[] = [];

  constructor(parent: Scope | null) {
    this._parent = parent;
  }

  get(key: unknown): unknown {
    let currentScope: Scope | null = this;
    do {
      for (let i = currentScope._entries.length - 1; i >= 0; i--) {
        const entry = currentScope._entries[i]!;
        if (Object.is(entry.key, key)) {
          return entry.value;
        }
      }
      currentScope = currentScope._parent;
    } while (currentScope !== null);
    return undefined;
  }

  set(key: unknown, value: unknown): void {
    this._entries.push({ key, value });
  }
}

export function areDirectiveTypesEqual(
  x: DirectiveType<unknown>,
  y: DirectiveType<unknown>,
): boolean {
  return x.equals?.(y) ?? x === y;
}

/**
 * @internal
 */
export function getChildNodes(
  startNode: ChildNode,
  endNode: ChildNode,
): ChildNode[] {
  const childNodes = [startNode];
  let currentNode: ChildNode | null = startNode;

  while (currentNode !== endNode && currentNode.nextSibling !== null) {
    currentNode = currentNode.nextSibling;
    childNodes.push(currentNode);
  }

  return childNodes;
}

/**
 * @internal
 */
export function getFlushLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes: Lanes;

  switch (options.priority) {
    case 'user-blocking':
      lanes = Lanes.UserBlockingLane;
      break;
    case 'user-visible':
      lanes = Lanes.UserBlockingLane | Lanes.UserVisibleLane;
      break;
    case 'background':
      lanes =
        Lanes.UserBlockingLane | Lanes.UserVisibleLane | Lanes.BackgroundLane;
      break;
    default:
      lanes = Lanes.DefaultLanes;
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
export function getScheduleLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes: Lanes;

  switch (options.priority) {
    case 'user-blocking':
      lanes = Lanes.UserBlockingLane;
      break;
    case 'user-visible':
      lanes = Lanes.UserVisibleLane;
      break;
    case 'background':
      lanes = Lanes.BackgroundLane;
      break;
    default:
      lanes = Lanes.DefaultLanes;
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
export function getStartNode(part: Part): ChildNode {
  return part.type === PartType.ChildNode
    ? (part.childNode ?? part.node)
    : part.node;
}

export function isBindable(value: unknown): value is Bindable {
  return typeof (value as Bindable<unknown>)?.[$toDirective] === 'function';
}

/**
 * @internal
 */
export function moveChildNodes(
  childNodes: ChildNode[],
  referenceNode: Node,
): void {
  const { parentNode } = referenceNode;

  if (parentNode !== null) {
    const insertOrMoveBefore =
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;

    for (let i = 0, l = childNodes.length; i < l; i++) {
      insertOrMoveBefore.call(parentNode, childNodes[i]!, referenceNode);
    }
  }
}
