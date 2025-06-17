import type {
  Hook,
  HookContext,
  Lanes,
  UpdateOptions,
  UpdateTask,
} from './hook.js';
import type { HydrationTree } from './hydration.js';
import type { ChildNodePart, Part } from './part.js';
import type { Literal, TemplateLiteral } from './templateLiteral.js';

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
  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export interface Coroutine extends Effect {
  resume(lanes: Lanes, context: UpdateContext): Lanes;
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
  | (T & (PrimitiveValue | DirectiveObject<T> | null | undefined))
  | DirectiveElement<T>
  | SlotElement<T>;

export const BindableType = {
  PrimitiveValue: 0,
  DirectiveObject: 1,
  DirectiveElement: 2,
  SlotElement: 3,
} as const;

export type BindableType = (typeof BindableType)[keyof typeof BindableType];

export interface PrimitiveValue {
  readonly [bindableTypeTag]?: typeof BindableType.PrimitiveValue;
}

export interface DirectiveObject<T> {
  readonly [bindableTypeTag]: typeof BindableType.DirectiveObject;
  readonly directive: Directive<T>;
}

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

export interface BindableElement<T> {
  readonly directive: Directive<T>;
  readonly value: T;
  readonly slotType?: SlotType;
}

export interface Primitive<T> extends Directive<T> {
  ensureValue?(value: unknown, part: Part): asserts value is T;
}

export interface Template<TBinds extends readonly Bindable<unknown>[]>
  extends Directive<TBinds> {
  render(
    binds: TBinds,
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateBlock<TBinds>;
  hydrate(
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateBlock<TBinds>;
}

export type TemplateMode = 'html' | 'math' | 'svg';

export interface TemplateBlock<TBinds extends readonly Bindable<unknown>[]> {
  readonly childNodes: ChildNode[];
  readonly slots: TemplateSlots<TBinds>;
}

export type TemplateSlots<TBinds extends readonly Bindable<unknown>[]> = {
  [K in keyof TBinds]: TBinds[K] extends Bindable<infer T> ? Slot<T> : never;
};

export interface Component<TProps, TResult> extends Directive<TProps> {
  render(props: TProps, context: RenderContext): Bindable<TResult>;
  shouldUpdate(nextProps: TProps, prevProps: TProps): boolean;
}

export interface ComponentFunction<TProps, TResult = unknown> {
  (props: TProps, context: RenderContext): Bindable<TResult>;
  shouldUpdate?(nextProps: TProps, prevProps: TProps): boolean;
}

export interface DirectiveContext {
  resolveDirective<T>(value: Bindable<T>, part: Part): BindableElement<T>;
  resolveSlot<T>(value: Bindable<T>, part: Part): Slot<T>;
}

export interface UpdateContext extends DirectiveContext {
  createIsolatedContext(): UpdateContext;
  enqueueCoroutine(coroutine: Coroutine): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  expandLiterals<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T>;
  flushAsync(options?: UpdateOptions): Promise<void>;
  flushSync(options?: UpdateOptions): void;
  getContextValue(key: unknown): unknown;
  getTemplate(
    strings: readonly string[],
    binds: readonly Bindable<unknown>[],
    mode: TemplateMode,
  ): Template<readonly Bindable<unknown>[]>;
  hydrateTemplate<TBinds extends readonly Bindable<unknown>[]>(
    template: Template<TBinds>,
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
  ): TemplateBlock<TBinds>;
  nextIdentifier(): string;
  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    lanes: Lanes,
    coroutine: Coroutine,
  ): RenderResult<TResult>;
  renderTemplate<TBinds extends readonly Bindable<unknown>[]>(
    template: Template<TBinds>,
    binds: TBinds,
    part: ChildNodePart,
  ): TemplateBlock<TBinds>;
  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateTask;
  setContextValue(key: unknown, value: unknown): void;
}

export interface RenderContext extends HookContext {
  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: readonly (Bindable<unknown> | Literal)[]
  ): DirectiveElement<readonly Bindable<unknown>[]>;
  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: readonly (Bindable<unknown> | Literal)[]
  ): DirectiveElement<readonly Bindable<unknown>[]>;
  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: readonly (Bindable<unknown> | Literal)[]
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

export interface RenderResult<T> {
  result: Bindable<T>;
  lanes: Lanes;
}

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
