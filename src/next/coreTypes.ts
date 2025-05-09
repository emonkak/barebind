import type {
  ContextualKey,
  Hook,
  HookProtocol,
  UpdateOptions,
} from './hook.js';
import type { ChildNodePart, Part } from './part.js';

export const resolveBindingTag = Symbol('Directive.resolveBinding');

export interface Directive<T> {
  [resolveBindingTag](
    value: T,
    part: Part,
    context: DirectiveProtocol,
  ): Binding<T>;
}

export type DirectiveValue<T> = T | DirectiveElement<T>;

export interface DirectiveElement<T> {
  readonly directive: Directive<T>;
  readonly value: T;
}

export interface Binding<T> extends Effect {
  get directive(): Directive<T>;
  get value(): T;
  get part(): Part;
  connect(context: UpdateProtocol): void;
  bind(value: T, context: UpdateProtocol): void;
  unbind(context: UpdateProtocol): void;
  disconnect(context: UpdateProtocol): void;
}

export interface Template<T> extends Directive<T> {
  render(binds: T, context: DirectiveProtocol): TemplateInstance<T>;
}

export type TemplateMode = 'html' | 'math' | 'svg';

export interface TemplateInstance<TBinds> extends Effect {
  connect(context: UpdateProtocol): void;
  bind(binds: TBinds, context: UpdateProtocol): void;
  unbind(context: UpdateProtocol): void;
  disconnect(context: UpdateProtocol): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
}

export type ComponentFunction<T> = (
  props: T,
  context: RenderProtocol,
) => DirectiveValue<unknown>;

export interface Effect {
  commit(context: EffectProtocol): void;
}

export interface EffectProtocol {
  phase: CommitPhase;
}

export enum CommitPhase {
  Mutation,
  Layout,
  Passive,
}

export interface RenderProtocol extends HookProtocol {
  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<unknown[]>;
  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<unknown[]>;
  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<unknown[]>;
  html(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<unknown[]>;
  math(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<unknown[]>;
  svg(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<unknown[]>;
}

export interface UpdateProtocol extends DirectiveProtocol {
  enqueueBinding(binding: Binding<unknown>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  enterContextualScope<T>(context: ContextualKey<T>, value: T): UpdateProtocol;
  renderComponent<TProps>(
    component: ComponentFunction<TProps>,
    props: TProps,
    hooks: Hook[],
    binding: Binding<TProps>,
  ): unknown;
  renderTemplate<TBinds>(
    template: Template<TBinds>,
    binds: TBinds,
  ): TemplateInstance<TBinds>;
  scheduleUpdate(
    binding: Binding<unknown>,
    options?: UpdateOptions,
  ): Promise<void>;
}

export interface DirectiveProtocol {
  resolvePrimitiveElement<T>(value: T, part: Part): DirectiveElement<T>;
  prepareBinding<T>(value: DirectiveValue<T>, part: Part): Binding<T>;
  reconcileBinding<T>(
    binding: Binding<T>,
    value: DirectiveValue<T>,
  ): Binding<T>;
}

export function isDirective(value: unknown): value is Directive<unknown> {
  return (
    typeof value === 'object' && value !== null && resolveBindingTag in value
  );
}

export function isDirectiveElement(
  value: unknown,
): value is DirectiveElement<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    isDirective((value as DirectiveElement<unknown>).directive)
  );
}
