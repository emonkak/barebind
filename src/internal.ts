/// <reference path="../typings/scheduler.d.ts" />

import type { Literal, TemplateLiteral } from './template-literal.js';

export const $customHook: unique symbol = Symbol('$customHook');

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
  hydrate(target: HydrationTree, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

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
  shouldSkipUpdate(nextProps: TProps, prevProps: TProps): boolean;
}

export interface Coroutine {
  pendingLanes: Lanes;
  resume(context: UpdateContext): void;
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
  resolveDirective<T>(value: T, part: Part): Directive<UnwrapBindable<T>>;
  resolveSlot<T>(value: T, part: Part): Slot<T>;
}

export interface DirectiveType<T> {
  readonly name: string;
  equals?(other: DirectiveType<unknown>): boolean;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface Effect {
  commit(): void;
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
    reducer: (state: TState, action: TAction) => TState;
    dispatch: (action: TAction) => void;
    pendingLanes: Lanes;
    pendingState: TState;
    memoizedState: TState;
  }
}

export interface HookContext {
  forceUpdate(options?: ScheduleOptions): UpdateHandle;
  getSharedContext(key: unknown): unknown;
  isUpdatePending(): boolean;
  setSharedContext(key: unknown, value: unknown): void;
  use<T>(usable: Usable<T>): T;
  useCallback<TCallback extends (...args: any[]) => any>(
    callback: TCallback,
    dependencies: readonly unknown[],
  ): TCallback;
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
    dispatch: (action: TAction, options?: ScheduleOptions) => void,
    isPending: boolean,
  ];
  useRef<T>(initialValue: T): RefObject<T>;
  useState<TState>(
    initialState: InitialState<TState>,
  ): [
    state: TState,
    setState: (newState: NewState<TState>, options?: ScheduleOptions) => void,
    isPending: boolean,
  ];
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

export class HydrationError extends Error {}

export type HydrationTree = TreeWalker;

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

export interface RenderState {
  hooks: Hook[];
  pendingLanes: Lanes;
}

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}

export interface ReversibleEffect extends Effect {
  rollback(): void;
}

export interface ScheduleOptions {
  immediate?: boolean;
  priority?: TaskPriority;
  silent?: boolean;
  viewTransition?: boolean;
}

export interface Scope {
  readonly parent: Scope | null;
  readonly contexts: SharedContext[];
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
    hooks: Hook[],
    coroutine: Coroutine,
    frame: UpdateFrame,
    scope: Scope,
  ): TResult;
  resolveTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  scheduleUpdate(coroutine: Coroutine, options?: ScheduleOptions): UpdateHandle;
}

export interface SharedContext {
  key: unknown;
  value: unknown;
}

export interface Slot<T> extends ReversibleEffect {
  readonly type: DirectiveType<UnwrapBindable<T>>;
  readonly value: UnwrapBindable<T>;
  readonly part: Part;
  reconcile(value: T, context: UpdateContext): boolean;
  hydrate(target: HydrationTree, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export interface SlotType {
  new <T>(binding: Binding<UnwrapBindable<T>>): Slot<T>;
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
    target: HydrationTree,
    context: UpdateContext,
  ): TemplateResult;
}

export interface TemplateFactory {
  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export interface TemplateResult {
  readonly childNodes: readonly ChildNode[];
  readonly slots: Slot<unknown>[];
}

export type UnwrapBindable<T> = T extends Bindable<infer Value> ? Value : T;

export interface UpdateContext {
  frame: UpdateFrame;
  scope: Scope;
  runtime: SessionContext;
}

export interface UpdateFrame {
  id: number;
  lanes: Lanes;
  pendingCoroutines: Coroutine[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export interface UpdateHandle {
  lanes: Lanes;
  scheduled: Promise<void>;
  finished: Promise<void>;
}

export interface UpdateTask {
  coroutine: Coroutine;
  lanes: Lanes;
  continuation: PromiseWithResolvers<void>;
}

export type Usable<T> = CustomHookFunction<T> | CustomHookObject<T>;

/**
 * @internal
 */
export function areDirectiveTypesEqual(
  x: DirectiveType<unknown>,
  y: DirectiveType<unknown>,
): boolean {
  return x.equals?.(y) ?? x === y;
}

/**
 * @internal
 */
export function createScope(parent: Scope | null = null): Scope {
  return {
    parent,
    contexts: [],
  };
}

/**
 * @internal
 */
export function createUpdateContext(
  frame: UpdateFrame,
  scope: Scope,
  runtime: SessionContext,
): UpdateContext {
  return { frame, scope, runtime };
}

/**
 * @internal
 */
export function getSharedContext(scope: Scope, key: unknown): unknown {
  let currentScope: Scope | null = scope;
  do {
    const { contexts } = currentScope;
    for (let i = contexts.length - 1; i >= 0; i--) {
      const context = contexts[i]!;
      if (Object.is(context.key, key)) {
        return context.value;
      }
    }
    currentScope = currentScope.parent;
  } while (currentScope !== null);
  return undefined;
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
export function getLanesFromOptions(options: ScheduleOptions): Lanes {
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

/**
 * @internal
 */
export function setSharedContext(
  scope: Scope,
  key: unknown,
  value: unknown,
): void {
  scope.contexts.push({ key, value });
}
