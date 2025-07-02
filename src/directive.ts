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
  resolveDirective(value: unknown, part: Part): DirectiveElement<unknown>;
  resolveSlot<T>(value: T, part: Part): Slot<T>;
}

export interface EffectContext {
  debugValue(directive: Directive<unknown>, value: unknown, part: Part): void;
  undebugValue(directive: Directive<unknown>, value: unknown, part: Part): void;
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
  getCurrentScope(): Scope;
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
  lanes: Lanes;
}

export interface DirectiveObject<T> extends Bindable<T> {
  readonly directive: Directive<T>;
  readonly value: T;
}

export interface SlotObject<T> extends Bindable<unknown> {
  value: T;
  slotType: SlotType;
}

export function createDirectiveObject<T>(
  directive: Directive<T>,
  value: T,
): DirectiveObject<T> {
  return {
    [$toDirectiveElement](): DirectiveElement<T> {
      return this;
    },
    directive,
    value,
  };
}

export function createSlotObject<T>(
  value: T,
  slotType: SlotType,
): SlotObject<T> {
  return {
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
    },
    value,
    slotType,
  };
}

export function isBindableObject<T>(value: T): value is T & Bindable<T> {
  return typeof (value as Bindable<T>)?.[$toDirectiveElement] === 'function';
}
