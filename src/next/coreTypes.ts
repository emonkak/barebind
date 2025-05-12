/// <reference path="../../typings/scheduler.d.ts" />

import type { Hook, HookContext, UpdateOptions } from './hook.js';
import type { ChildNodePart, Part } from './part.js';

export const directiveTag: unique symbol = Symbol('DirectiveObject.directive');

const directiveElementTag = Symbol('DirectiveElement');

export interface Directive<T> {
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface DirectiveElement<T> {
  readonly directive: Directive<T>;
  readonly value: T;
  readonly __tag: typeof directiveElementTag;
}

export interface DirectiveObject<T> {
  readonly [directiveTag]: Directive<T>;
}

export type Bindable<T> = T | DirectiveElement<T> | DirectiveObject<T>;

export interface Binding<T> extends Effect {
  get directive(): Directive<T>;
  get value(): T;
  get part(): Part;
  connect(context: UpdateContext): void;
  bind(value: T, context: UpdateContext): void;
  unbind(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
}

export interface Template<T> extends Directive<T> {
  render(binds: T, context: DirectiveContext): TemplateInstance<T>;
}

export type TemplateMode = 'html' | 'math' | 'svg';

export interface TemplateInstance<TBinds> extends Effect {
  connect(context: UpdateContext): void;
  bind(binds: TBinds, context: UpdateContext): void;
  unbind(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
}

export type Component<TProps, TResult> = (
  props: TProps,
  context: RenderContext,
) => TResult;

export interface Effect {
  commit(context: EffectContext): void;
}

export interface EffectContext {
  phase: CommitPhase;
}

export interface EffectOptions {
  priority?: TaskPriority;
}

export enum CommitPhase {
  Mutation,
  Layout,
  Passive,
}

export interface RenderContext extends HookContext {
  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<readonly unknown[]>;
  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<readonly unknown[]>;
  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<readonly unknown[]>;
  html(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<readonly unknown[]>;
  math(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<readonly unknown[]>;
  svg(
    strings: TemplateStringsArray,
    ...binds: unknown[]
  ): DirectiveElement<readonly unknown[]>;
}

export interface UpdateContext extends DirectiveContext {
  enqueueBinding(binding: Binding<unknown>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    binding: Binding<TProps>,
  ): TResult;
  renderTemplate<TBinds>(
    template: Template<TBinds>,
    binds: TBinds,
  ): TemplateInstance<TBinds>;
  scheduleEffect(effect: Effect, options?: EffectOptions): Promise<void>;
  scheduleUpdate(
    binding: Binding<unknown>,
    options?: UpdateOptions,
  ): Promise<void>;
}

export interface DirectiveContext {
  resolveDirectiveElement<T>(
    value: Bindable<T>,
    part: Part,
  ): DirectiveElement<T>;
  resolveBinding<T>(value: Bindable<T>, part: Part): Binding<T>;
  reconcileBinding<T>(binding: Binding<T>, value: Bindable<T>): Binding<T>;
}

export function createDirectiveElement<T>(
  directive: Directive<T>,
  value: T,
): DirectiveElement<T> {
  return {
    directive,
    value,
    __tag: directiveElementTag,
  };
}

export function isDirectiveElement(
  value: unknown,
): value is DirectiveElement<unknown> {
  return (value as DirectiveElement<unknown>)?.__tag === directiveElementTag;
}

export function isDirectiveObject(
  value: unknown,
): value is DirectiveObject<unknown> {
  return (value as DirectiveObject<unknown>)?.[directiveTag] != null;
}
