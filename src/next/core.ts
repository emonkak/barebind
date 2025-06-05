import type { Hook, HookContext, UpdateOptions } from './hook.js';
import type { ChildNodePart, Part } from './part.js';
import type { TemplateLiteral } from './templateLiteral.js';

export const bindableTag: unique symbol = Symbol('Bindable');

export interface Directive<T> {
  readonly name: string;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface DirectiveContext {
  resolveSlot<T>(value: Bindable<T>, part: Part): Slot<T>;
  resolveDirective<T>(value: Bindable<T>, part: Part): BindableElement<T>;
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
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export interface ResumableBinding<T> extends Binding<T> {
  resume(context: UpdateContext): void;
}

export interface Slot<T> extends ReversibleEffect {
  readonly directive: Directive<T>;
  readonly value: T;
  readonly part: Part;
  reconcile(value: Bindable<T>, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export interface SlotType {
  new <T>(binding: Binding<T>): Slot<T>;
}

export type Bindable<T> =
  | PrimitiveValue<T>
  | DirectiveValue<T>
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
  DirectiveValue: 1,
  DirectiveElement: 2,
  SlotElement: 3,
} as const;

export type BindableType = (typeof BindableType)[keyof typeof BindableType];

export type PrimitiveValue<T> = T & {
  readonly [bindableTag]?: typeof BindableType.PrimitiveValue;
};

export type DirectiveValue<T> = T & {
  readonly [bindableTag]: typeof BindableType.DirectiveValue;
  readonly directive: Directive<T>;
};

export interface DirectiveElement<T> {
  readonly [bindableTag]: typeof BindableType.DirectiveElement;
  readonly directive: Directive<T>;
  readonly value: T;
}

export interface SlotElement<T> {
  readonly [bindableTag]: typeof BindableType.SlotElement;
  readonly value: Bindable<T>;
  readonly slotType: SlotType;
}

export interface Template<TBinds> extends Directive<TBinds> {
  render(binds: TBinds, context: DirectiveContext): TemplateBlock<TBinds>;
}

export type TemplateMode = 'html' | 'math' | 'svg';

export interface TemplateBlock<TBinds> extends ReversibleEffect {
  reconcile(binds: TBinds, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
}

export interface UpdateContext extends DirectiveContext {
  clone(): UpdateContext;
  createMarkerNode(): ChildNode;
  enqueueBinding(binding: ResumableBinding<unknown>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  expandLiterals(
    strings: TemplateStringsArray,
    values: readonly unknown[],
  ): TemplateLiteral;
  flushFrame(options?: UpdateOptions): Promise<void>;
  getContextualValue<T>(key: unknown): T | undefined;
  getTemplate(
    strings: readonly string[],
    binds: readonly Bindable<unknown>[],
    mode: TemplateMode,
  ): Template<readonly Bindable<unknown>[]>;
  nextIdentifier(): string;
  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    binding: ResumableBinding<TProps>,
  ): Bindable<TResult>;
  renderTemplate<TBinds>(
    template: Template<TBinds>,
    binds: TBinds,
  ): TemplateBlock<TBinds>;
  scheduleUpdate(
    binding: ResumableBinding<unknown>,
    options?: UpdateOptions,
  ): Promise<void>;
  setContextualValue<T>(key: unknown, value: T): void;
}

export type Component<TProps, TResult> = (
  props: TProps,
  context: RenderContext,
) => Bindable<TResult>;

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

export function createDirectiveElement<T>(
  directive: Directive<T>,
  value: T,
): DirectiveElement<T> {
  return {
    [bindableTag]: BindableType.DirectiveElement,
    directive,
    value,
  };
}

export function createSlotElement<T>(
  value: Bindable<T>,
  slotType: SlotType,
): SlotElement<T> {
  return {
    [bindableTag]: BindableType.SlotElement,
    value,
    slotType,
  };
}
