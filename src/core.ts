/// <reference path="../typings/scheduler.d.ts" />

import type { HydrationTree } from './hydration.js';
import type { ChildNodePart, Part } from './part.js';
import type { Scope } from './scope.js';
import type { Literal, TemplateLiteral } from './template-literal.js';

export const $toDirective: unique symbol = Symbol('$toDirective');

export interface Directive<T> {
  readonly type: DirectiveType<T>;
  readonly value: T;
  readonly slotType?: SlotType;
}

export interface DirectiveType<T> {
  readonly name: string;
  equals?(other: DirectiveType<unknown>): boolean;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
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
  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
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

export interface Primitive<T> extends DirectiveType<T> {
  ensureValue?(value: unknown, part: Part): asserts value is T;
}

export interface Template<TBinds extends readonly unknown[]>
  extends DirectiveType<TBinds> {
  readonly arity: TBinds['length'];
  render(
    binds: TBinds,
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateResult;
  hydrate(
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateResult;
}

export type TemplateMode = 'html' | 'math' | 'svg';

export interface TemplateResult {
  readonly childNodes: readonly ChildNode[];
  readonly slots: Slot<unknown>[];
}

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

export interface Effect {
  commit(context: CommitContext): void;
}

export interface ReversibleEffect extends Effect {
  rollback(context: CommitContext): void;
}

export const Lane = {
  UserBlocking: 0b1,
  UserVisible: 0b10,
  Background: 0b100,
  Transition: 0b1000,
} as const;

export type Lane = (typeof Lane)[keyof typeof Lane];

export type Lanes = number;

export const NO_LANES: Lanes = 0;
export const ALL_LANES: Lanes = -1;
export const DEFAULT_LANES: Lanes =
  Lane.UserBlocking | Lane.UserVisible | Lane.Background;

export interface UpdateOptions {
  priority?: TaskPriority;
  transition?: boolean;
}

export type Hook =
  | FinalizerHook
  | EffectHook
  | IdHook
  | MemoHook<any>
  | ReducerHook<any, any>;

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

export interface CustomHook<T> {
  onCustomHook(context: HookContext): T;
}

export type InitialState<T> = [T] extends [Function] ? () => T : (() => T) | T;

export type NewState<T> = [T] extends [Function]
  ? (prevState: T) => T
  : ((prevState: T) => T) | T;

export interface RefObject<T> {
  current: T;
}

export interface UpdateTask {
  lanes: Lanes;
  promise: Promise<void>;
}

export const CommitPhase = {
  Mutation: 0,
  Layout: 1,
  Passive: 2,
} as const;

export type CommitPhase = (typeof CommitPhase)[keyof typeof CommitPhase];

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}

export interface HostEnvironment {
  commitEffects(
    effects: Effect[],
    phase: CommitPhase,
    context: CommitContext,
  ): void;
  createTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  getCurrentPriority(): TaskPriority;
  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void>;
  resolvePrimitive(value: unknown, part: Part): Primitive<unknown>;
  resolveSlotType(value: unknown, part: Part): SlotType;
  startViewTransition(callback: () => void | Promise<void>): Promise<void>;
  yieldToMain(): Promise<void>;
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

export interface DirectiveContext {
  resolveDirective<T>(value: T, part: Part): Directive<unknown>;
  resolveSlot<T>(value: T, part: Part): Slot<T>;
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

export interface CommitContext {
  debugValue(type: DirectiveType<unknown>, value: unknown, part: Part): void;
  undebugValue(type: DirectiveType<unknown>, value: unknown, part: Part): void;
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
export function getFlushLanesFromOptions(options: UpdateOptions): Lanes {
  let lanes: Lanes;

  switch (options.priority) {
    case 'user-blocking':
      lanes = Lane.UserBlocking;
      break;
    case 'user-visible':
      lanes = Lane.UserBlocking | Lane.UserVisible;
      break;
    case 'background':
      lanes = Lane.UserBlocking | Lane.UserVisible | Lane.Background;
      break;
    default:
      lanes = DEFAULT_LANES;
      break;
  }

  if (options.transition) {
    lanes |= Lane.Transition;
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
      lanes = Lane.UserBlocking;
      break;
    case 'user-visible':
      lanes = Lane.UserVisible;
      break;
    case 'background':
      lanes = Lane.Background;
      break;
    default:
      lanes = DEFAULT_LANES;
      break;
  }

  if (options.transition) {
    lanes |= Lane.Transition;
  }

  return lanes;
}

/**
 * @internal
 */
export function isBindable(value: unknown): value is Bindable {
  return typeof (value as Bindable<unknown>)?.[$toDirective] === 'function';
}
