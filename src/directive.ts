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

export const $toDirectiveElement: unique symbol = Symbol('$toDirectiveElement');

export interface Directive<T> {
  readonly displayName: string;
  equals?(other: Directive<unknown>): boolean;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface DirectiveElement<T> {
  readonly directive: Directive<T>;
  readonly value: T;
  readonly slotType?: SlotType;
}

export interface Bindable<T> {
  [$toDirectiveElement](): DirectiveElement<T>;
}

export interface Effect {
  commit(context: CommitContext): void;
}

export interface ReversibleEffect extends Effect {
  rollback(context: CommitContext): void;
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
  shouldSkipUpdate(nextProps: TProps, prevProps: TProps): boolean;
}

export interface ComponentFunction<TProps, TResult = unknown> {
  (props: TProps, context: RenderContext): TResult;
  shouldSkipUpdate?(nextProps: TProps, prevProps: TProps): boolean;
}

export interface Coroutine extends Effect {
  resume(lanes: Lanes, context: UpdateContext): Lanes;
}

export interface DirectiveContext {
  resolveDirective<T>(value: Bindable<T>, part: Part): DirectiveElement<T>;
  resolveDirective(value: unknown, part: Part): DirectiveElement<unknown>;
  resolveSlot<T>(value: T, part: Part): Slot<T>;
}

export interface CommitContext {
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

export const DelegateDirective: Directive<any> = {
  displayName: 'DelegateDirective',
  resolveBinding<T>(
    value: T,
    part: Part,
    context: DirectiveContext,
  ): Binding<T> {
    const element = context.resolveDirective(value, part);
    return element.directive.resolveBinding(
      element.value,
      part,
      context,
    ) as Binding<T>;
  },
};

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

  [$toDirectiveElement](): DirectiveElement<unknown> {
    const { value, slotType } = this;

    if (isBindable(value)) {
      return { ...value[$toDirectiveElement](), slotType };
    } else {
      return {
        directive: DelegateDirective,
        value,
        slotType,
      };
    }
  }
}

export function areDirectivesEqual(
  firstDirective: Directive<unknown>,
  secondDirective: Directive<unknown>,
) {
  return (
    firstDirective.equals?.(secondDirective) ??
    firstDirective === secondDirective
  );
}

export function isBindable(value: unknown): value is Bindable<unknown> {
  return (
    typeof (value as Bindable<unknown>)?.[$toDirectiveElement] === 'function'
  );
}
