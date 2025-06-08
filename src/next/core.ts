import type { Hook, HookContext, UpdateOptions } from './hook.js';
import type { HydrationTree } from './hydration.js';
import type { ChildNodePart, Part } from './part.js';
import type { TemplateLiteral } from './templateLiteral.js';

export const bindableTypeTag: unique symbol = Symbol('Bindable.type');

export interface Directive<T> {
  readonly name: string;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface Effect {
  commit(): void;
}

export interface ReversibleEffect extends Effect {
  rollback(): void;
}

export interface Binding<T> extends ReversibleEffect {
  readonly directive: Directive<T>;
  readonly value: T;
  readonly part: Part;
  shouldBind(value: T): boolean;
  bind(value: T): void;
  hydrate(hydrationTree: HydrationTree, context: DirectiveContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export interface Coroutine extends Effect {
  resume(context: UpdateContext): void;
}

export interface Slot<T> extends ReversibleEffect {
  readonly directive: Directive<T>;
  readonly value: T;
  readonly part: Part;
  reconcile(value: Bindable<T>, context: UpdateContext): void;
  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export interface SlotType {
  new <T>(binding: Binding<T>): Slot<T>;
}

export type Bindable<T> =
  | PrimitiveValue<T>
  | DirectiveObject<T>
  | DirectiveElement<T>
  | SlotElement<T>
  | (T & null)
  | (T & undefined);

export interface BindableElement<T> {
  readonly directive: Directive<T>;
  readonly value: T;
  readonly slotType?: SlotType;
}

export const BindableType = {
  PrimitiveValue: 0,
  DirectiveObject: 1,
  DirectiveElement: 2,
  SlotElement: 3,
} as const;

export type BindableType = (typeof BindableType)[keyof typeof BindableType];

export type PrimitiveValue<T> = T & {
  readonly [bindableTypeTag]?: typeof BindableType.PrimitiveValue;
};

export type DirectiveObject<T> = T & {
  readonly [bindableTypeTag]: typeof BindableType.DirectiveObject;
  readonly directive: Directive<T>;
};

export interface DirectiveElement<T> {
  readonly [bindableTypeTag]: typeof BindableType.DirectiveElement;
  readonly directive: Directive<T>;
  readonly value: T;
}

export interface SlotElement<T> {
  readonly [bindableTypeTag]: typeof BindableType.SlotElement;
  readonly value: Bindable<T>;
  readonly slotType: SlotType;
}

export interface Primitive<T> extends Directive<T> {
  ensureValue(value: unknown, part: Part): asserts value is T;
}

export interface Template<TBinds> extends Directive<TBinds> {
  render(
    binds: TBinds,
    part: ChildNodePart,
    context: DirectiveContext,
  ): TemplateBlock<TBinds>;
  hydrate(
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: DirectiveContext,
  ): TemplateBlock<TBinds>;
}

export type TemplateMode = 'html' | 'math' | 'svg';

export interface TemplateBlock<TBinds> extends ReversibleEffect {
  reconcile(binds: TBinds, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
}

export interface Component<TProps, TResult> extends Directive<TProps> {
  render: ComponentFunction<TProps, TResult>;
}

export type ComponentFunction<TProps, TResult> = (
  props: TProps,
  context: RenderContext,
) => Bindable<TResult>;

export interface DirectiveContext {
  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    coroutine: Coroutine,
  ): Bindable<TResult>;
  renderTemplate<TBinds>(
    template: Template<TBinds>,
    binds: TBinds,
    part: ChildNodePart,
  ): TemplateBlock<TBinds>;
  resolveSlot<T>(value: Bindable<T>, part: Part): Slot<T>;
  resolveDirective<T>(value: Bindable<T>, part: Part): BindableElement<T>;
}

export interface UpdateContext extends DirectiveContext {
  clone(): UpdateContext;
  enqueueCoroutine(coroutine: Coroutine): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  expandLiterals(
    strings: TemplateStringsArray,
    values: readonly unknown[],
  ): TemplateLiteral;
  flushAsync(options?: UpdateOptions): Promise<void>;
  flushSync(options?: UpdateOptions): void;
  getContextualValue<T>(key: unknown): T | undefined;
  getTemplate(
    strings: readonly string[],
    binds: readonly Bindable<unknown>[],
    mode: TemplateMode,
  ): Template<readonly Bindable<unknown>[]>;
  hydrateTemplate<TBinds>(
    template: Template<TBinds>,
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
  ): TemplateBlock<TBinds>;
  nextIdentifier(): string;
  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): Promise<void>;
  setContextualValue<T>(key: unknown, value: T): void;
}

export interface RenderContext extends HookContext {
  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: readonly Bindable<unknown>[]
  ): DirectiveElement<readonly Bindable<unknown>[]>;
  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: readonly Bindable<unknown>[]
  ): DirectiveElement<readonly Bindable<unknown>[]>;
  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: readonly Bindable<unknown>[]
  ): DirectiveElement<readonly Bindable<unknown>[]>;
  html(
    strings: TemplateStringsArray,
    ...binds: readonly Bindable<unknown>[]
  ): DirectiveElement<readonly Bindable<unknown>[]>;
  math(
    strings: TemplateStringsArray,
    ...binds: readonly Bindable<unknown>[]
  ): DirectiveElement<readonly Bindable<unknown>[]>;
  svg(
    strings: TemplateStringsArray,
    ...binds: readonly Bindable<unknown>[]
  ): DirectiveElement<readonly Bindable<unknown>[]>;
}

export class Literal extends String {}

export function createDirectiveElement<T>(
  directive: Directive<T>,
  value: T,
): DirectiveElement<T> {
  return {
    [bindableTypeTag]: BindableType.DirectiveElement,
    directive,
    value,
  };
}

export function createSlotElement<T>(
  value: Bindable<T>,
  slotType: SlotType,
): SlotElement<T> {
  return {
    [bindableTypeTag]: BindableType.SlotElement,
    value,
    slotType,
  };
}
