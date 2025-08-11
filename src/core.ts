/// <reference path="../typings/scheduler.d.ts" />

import { debugNode } from './debug/node.js';
import type { LinkedList } from './linked-list.js';

export const $customHook: unique symbol = Symbol('$customHook');

export const $toDirective: unique symbol = Symbol('$toDirective');

export interface Backend {
  commitEffects(
    effects: Effect[],
    phase: CommitPhase,
    context: CommitContext,
  ): void;
  getCurrentPriority(): TaskPriority;
  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void>;
  resolvePrimitive(value: unknown, part: Part): Primitive<unknown>;
  resolveSlotType(value: unknown, part: Part): SlotType;
  startViewTransition(callback: () => void | Promise<void>): Promise<void>;
  yieldToMain(): Promise<void>;
}

export interface Bindable<T = unknown> {
  [$toDirective](part: Part, context: DirectiveContext): Directive<T>;
}

export interface Binding<T> extends ReversibleEffect {
  readonly type: DirectiveType<T>;
  readonly value: T;
  readonly part: Part;
  shouldBind(value: T): boolean;
  bind(value: T): void;
  hydrate(tree: HydrationTree, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export type Cleanup = () => void;

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

export interface ComponentResult<T> {
  value: T;
  pendingLanes: Lanes;
}

export interface Coroutine extends Effect {
  resume(lanes: Lanes, context: UpdateContext): Lanes;
}

export type CustomHookFunction<T> = (context: HookContext) => T;

export interface CustomHookObject<T> {
  [$customHook](context: HookContext): T;
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
    callback: () => Cleanup | void;
    cleanup: Cleanup | void;
    dependencies: readonly unknown[] | null;
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
    lanes: Lanes;
    reducer: (state: TState, action: TAction) => TState;
    pendingState: TState;
    memoizedState: TState;
    dispatch: (action: TAction) => void;
  }
}

export interface HookContext {
  forceUpdate(options?: UpdateOptions): UpdateHandle;
  getContextValue(key: unknown): unknown;
  isUpdatePending(): boolean;
  setContextValue(key: unknown, value: unknown): void;
  use<T>(usable: Usable<T>): T;
  useCallback<TCallback extends (...args: any[]) => any>(
    callback: TCallback,
    dependencies: readonly unknown[],
  ): TCallback;
  useDeferredValue<T>(value: T, initialValue?: InitialState<T>): T;
  useEffect(
    callback: () => Cleanup | void,
    dependencies?: readonly unknown[],
  ): void;
  useId(): string;
  useInsertionEffect(
    callback: () => Cleanup | void,
    dependencies?: readonly unknown[],
  ): void;
  useLayoutEffect(
    callback: () => Cleanup | void,
    dependencies?: readonly unknown[],
  ): void;
  useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;
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
    subscribe: (subscriber: () => void) => Cleanup | void,
    getSnapshot: () => T,
  ): T;
  waitForUpdate(): Promise<number>;
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
  SyncLane: 0b1,
  UserBlockingLane: 0b10,
  UserVisibleLane: 0b100,
  BackgroundLane: 0b1000,
  HydrationLane: 0b10000,
  ConcurrentLane: 0b100000,
  ViewTransitionLane: 0b1000000,
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

export type RefCallback<T> = (value: T) => Cleanup | void;

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
  flushSync(lanes: Lanes): void;
  getCurrentScope(): Scope;
  getUpdateHandles(): LinkedList<UpdateHandle>;
  nextIdentifier(): string;
  resolveTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateHandle;
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
  reconcile(value: T, context: UpdateContext): boolean;
  hydrate(tree: HydrationTree, context: UpdateContext): void;
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
    tree: HydrationTree,
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
  concurrent?: boolean;
  priority?: TaskPriority;
  viewTransition?: boolean;
}

export interface UpdateHandle {
  coroutine: Coroutine;
  lanes: Lanes;
  running: boolean;
  promise: Promise<void>;
}

export type Usable<T> = CustomHookFunction<T> | CustomHookObject<T>;

interface ScopeEntry {
  key: unknown;
  value: unknown;
}

export class HydrationError extends Error {}

export class HydrationTree {
  private readonly _treeWalker: TreeWalker;

  private _lookaheadNode: Node | null;

  constructor(container: Element) {
    this._treeWalker = container.ownerDocument.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
    this._lookaheadNode = this._treeWalker.nextNode();
  }

  nextNode(expectedName: string): ChildNode {
    const lookaheadNode = this._lookaheadNode;
    ensureNode(expectedName, lookaheadNode, this._treeWalker.currentNode);
    this._lookaheadNode = this._treeWalker.nextNode();
    return lookaheadNode;
  }

  peekNode(expectedName: string): ChildNode {
    const lookaheadNode = this._lookaheadNode;
    ensureNode(expectedName, lookaheadNode, this._treeWalker.currentNode);
    return lookaheadNode;
  }

  splitText(): this {
    const currentNode = this._treeWalker.currentNode;
    const lookaheadNode = this._lookaheadNode;

    if (
      currentNode instanceof Text &&
      (lookaheadNode === null || lookaheadNode.previousSibling === currentNode)
    ) {
      const splittedText = currentNode.ownerDocument.createTextNode('');
      currentNode.after(splittedText);
      this._lookaheadNode = splittedText;
    }

    return this;
  }
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
function ensureNode<TName extends string>(
  expectedName: TName,
  actualNode: Node | null,
  lastNode: Node,
): asserts actualNode is ChildNode {
  if (actualNode === null) {
    throw new HydrationError(
      `Hydration is failed because there is no node. ${expectedName} node is expected here:\n` +
        debugNode(lastNode, '[[THIS IS THE LAST NODE!]]'),
    );
  }

  if (actualNode.nodeName !== expectedName) {
    throw new HydrationError(
      `Hydration is failed because the node is mismatched. ${expectedName} node is expected here:\n` +
        debugNode(lastNode, '[[THIS IS MISMATCHED!]]'),
    );
  }
}

/**
 * @internal
 */
export function getFlushLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes = Lanes.SyncLane;

  switch (options.priority) {
    case 'user-blocking':
      lanes |= Lanes.UserBlockingLane;
      break;
    case 'user-visible':
      lanes |= Lanes.UserBlockingLane | Lanes.UserVisibleLane;
      break;
    case 'background':
      lanes |=
        Lanes.UserBlockingLane | Lanes.UserVisibleLane | Lanes.BackgroundLane;
      break;
  }

  if (options.concurrent) {
    lanes |= Lanes.ConcurrentLane;
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
  let lanes = Lanes.NoLanes;

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

  if (options.concurrent) {
    lanes |= Lanes.ConcurrentLane;
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
    ? (part.childNode ?? part.node)
    : part.node;
}

export function isBindable(value: unknown): value is Bindable {
  return typeof (value as Bindable<unknown>)?.[$toDirective] === 'function';
}
