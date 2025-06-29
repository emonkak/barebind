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
import type { Literal, TemplateLiteral } from './templateLiteral.js';

export const $toDirectiveElement: unique symbol = Symbol('$toDirectiveElement');

export interface Directive<T> {
  readonly name: string;
  resolveBinding(
    argument: T,
    part: Part,
    context: DirectiveContext,
  ): Binding<T>;
}

export interface DirectiveElement<T> {
  readonly directive: Directive<T>;
  readonly value: T;
  readonly slotType?: SlotType;
}

export interface Bindable<T> {
  [$toDirectiveElement](
    part: Part,
    context: DirectiveContext,
  ): DirectiveElement<T>;
}

export interface Effect {
  commit(context: EffectContext): void;
}

export interface ReversibleEffect extends Effect {
  rollback(context: EffectContext): void;
}

export interface Binding<T> extends ReversibleEffect {
  readonly directive: Directive<T>;
  readonly value: T;
  readonly part: Part;
  shouldBind(value: T): boolean;
  bind(value: T): void;
  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export interface Slot<T> extends ReversibleEffect {
  readonly directive: Directive<unknown>;
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

export interface Primitive<T> extends Directive<T> {
  ensureValue?(value: unknown, part: Part): asserts value is T;
}

export interface Template<TBinds extends readonly unknown[]>
  extends Directive<TBinds> {
  render(
    binds: TBinds,
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateBlock;
  hydrate(
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateBlock;
}

export type TemplateMode = 'html' | 'math' | 'svg';

export interface TemplateBlock {
  readonly childNodes: readonly ChildNode[];
  readonly slots: Slot<unknown>[];
}

export interface Component<TProps, TResult> extends Directive<TProps> {
  render(props: TProps, context: RenderContext): TResult;
  shouldUpdate(nextProps: TProps, prevProps: TProps): boolean;
}

export interface ComponentFunction<TProps, TResult = unknown> {
  (props: TProps, context: RenderContext): TResult;
  shouldUpdate?(nextProps: TProps, prevProps: TProps): boolean;
}

export interface Coroutine extends Effect {
  resume(lanes: Lanes, context: UpdateContext): Lanes;
}

export interface DirectiveContext {
  resolveDirective<T>(value: T, part: Part): DirectiveElement<unknown>;
  resolveSlot<T>(value: T, part: Part): Slot<T>;
}

export interface EffectContext {
  debugValue(directive: Directive<unknown>, value: unknown, part: Part): void;
  undebugValue(
    directive: Directive<unknown>,
    value: unknown,
    part: Part,
  ): void;
}

export interface UpdateContext extends DirectiveContext {
  enqueueCoroutine(coroutine: Coroutine): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  enterRenderFrame(): UpdateContext;
  enterScope(scope: Scope): UpdateContext;
  expandLiterals<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T>;
  flushAsync(options?: UpdateOptions): Promise<void>;
  flushSync(): void;
  getCurrentScope(): Scope;
  hydrateTemplate<TBinds extends readonly unknown[]>(
    template: Template<TBinds>,
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
  ): TemplateBlock;
  isPending(): boolean;
  nextIdentifier(): string;
  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    lanes: Lanes,
    coroutine: Coroutine,
  ): RenderResult<TResult>;
  renderTemplate<TBinds extends readonly unknown[]>(
    template: Template<TBinds>,
    binds: TBinds,
    part: ChildNodePart,
  ): TemplateBlock;
  resolveTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateTask;
  waitForUpdate(coroutine: Coroutine): Promise<void>;
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

export interface RenderResult<T> {
  result: T;
  lanes: Lanes;
}

export class DirectiveObject<T> implements Bindable<T> {
  readonly directive: Directive<T>;

  readonly value: T;

  constructor(directive: Directive<T>, value: T) {
    this.directive = directive;
    this.value = value;
  }

  [$toDirectiveElement](): DirectiveElement<T> {
    return this;
  }
}

export class SlotObject<T> implements Bindable<unknown> {
  readonly value: T;

  readonly slotType: SlotType;

  constructor(value: T, slotType: SlotType) {
    this.value = value;
    this.slotType = slotType;
  }

  [$toDirectiveElement](
    part: Part,
    context: DirectiveContext,
  ): DirectiveElement<unknown> {
    const { directive, value } = context.resolveDirective(this.value, part);
    return {
      directive,
      value,
      slotType: this.slotType,
    };
  }
}

export function isBindableObject<T>(value: T): value is T & Bindable<T> {
  return typeof (value as Bindable<T>)?.[$toDirectiveElement] === 'function';
}
