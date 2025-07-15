import { $inspect, type Inspectable } from './debug.js';
import type {
  Hook,
  HookContext,
  Lanes,
  UpdateOptions,
  UpdateTask,
} from './hook.js';
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
  readonly displayName: string;
  equals?(other: DirectiveType<unknown>): boolean;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface Bindable<T = unknown> {
  [$toDirective](part: Part, context: DirectiveContext): Directive<T>;
}

export interface Effect {
  commit(context: CommitContext): void;
}

export interface ReversibleEffect extends Effect {
  rollback(context: CommitContext): void;
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

export interface ComponentType<TProps, TResult = unknown> {
  (props: TProps, context: RenderContext): TResult;
  shouldSkipUpdate?(nextProps: TProps, prevProps: TProps): boolean;
}

export interface Coroutine extends Effect {
  resume(lanes: Lanes, context: UpdateContext): Lanes;
}

export interface DirectiveContext {
  resolveDirective<T>(value: T, part: Part): Directive<unknown>;
  resolveSlot<T>(value: T, part: Part): Slot<T>;
}

export interface CommitContext {
  debugValue(type: DirectiveType<unknown>, value: unknown, part: Part): void;
  undebugValue(type: DirectiveType<unknown>, value: unknown, part: Part): void;
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

export interface ComponentResult<T> {
  value: T;
  pendingLanes: Lanes;
}

export class DirectiveSpecifier<T> implements Bindable<T>, Inspectable {
  readonly type: DirectiveType<T>;

  readonly value: T;

  constructor(type: DirectiveType<T>, value: T) {
    this.type = type;
    this.value = value;
  }

  [$toDirective](): Directive<T> {
    return this;
  }

  [$inspect](inspect: (value: unknown) => string): string {
    return this.type.displayName + '(' + inspect(this.value) + ')';
  }
}

export class SlotSpecifier<T> implements Bindable {
  readonly slotType: SlotType;

  readonly value: T;

  constructor(slotType: SlotType, value: T) {
    this.slotType = slotType;
    this.value = value;
  }

  [$toDirective](part: Part, context: DirectiveContext): Directive<unknown> {
    const { value, slotType } = this;
    const directive = context.resolveDirective(value, part);
    return { ...directive, slotType };
  }

  [$inspect](inspect: (value: unknown) => string): string {
    return this.slotType.name + '(' + inspect(this.value) + ')';
  }
}

export function areDirectiveTypesEqual(
  x: DirectiveType<unknown>,
  y: DirectiveType<unknown>,
): boolean {
  return x.equals?.(y) ?? x === y;
}

export function isBindable(value: unknown): value is Bindable {
  return typeof (value as Bindable<unknown>)?.[$toDirective] === 'function';
}
