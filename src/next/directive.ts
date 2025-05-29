/// <reference path="../../typings/scheduler.d.ts" />

import type { Hook, HookContext, UpdateOptions } from './hook.js';
import type { Part } from './part.js';

export const bindableTag: unique symbol = Symbol('Bindable');

export interface Directive<T> {
  get name(): string;
  resolveBinding(value: T, part: Part, context: DirectiveContext): Binding<T>;
}

export interface DirectiveElement<T> {
  readonly directive: Directive<T>;
  readonly value: T;
  readonly [bindableTag]: BindableType.Element;
}

export interface DirectiveObject<T> {
  readonly directive: Directive<T>;
  readonly [bindableTag]: BindableType.Object;
}

export type Bindable<T> = T | DirectiveElement<T> | DirectiveObject<T>;

export enum BindableType {
  Element,
  Object,
}

export interface Binding<T> {
  get directive(): Directive<T>;
  get value(): T;
  get part(): Part;
  shouldBind(value: T): boolean;
  bind(value: T, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
  commit(): void;
  rollback(): void;
}

export interface ResumableBinding<T> extends Binding<T> {
  resume(context: UpdateContext): void;
}

export interface Template<TBinds, TPart extends Part = Part>
  extends Directive<TBinds> {
  render(
    binds: TBinds,
    context: DirectiveContext,
  ): TemplateBlock<TBinds, TPart>;
}

export interface TemplateBlock<TBinds, TPart extends Part> {
  bind(binds: TBinds, context: UpdateContext): void;
  connect(context: UpdateContext): void;
  disconnect(context: UpdateContext): void;
  commit(): void;
  rollback(): void;
  mount(part: TPart): void;
  unmount(part: TPart): void;
}

export type TemplateMode = 'html' | 'math' | 'svg';

export type Component<TProps, TResult> = (
  props: TProps,
  context: RenderContext,
) => TResult;

export interface Effect {
  commit(): void;
}

export interface RenderContext extends HookContext {
  dynamicHTML(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]>;
  dynamicMath(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]>;
  dynamicSVG(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]>;
  html(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]>;
  math(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]>;
  svg(
    strings: TemplateStringsArray,
    ...binds: readonly unknown[]
  ): DirectiveElement<readonly unknown[]>;
}

export interface UpdateContext extends DirectiveContext {
  clone(): UpdateContext;
  enqueueBinding(binding: ResumableBinding<unknown>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  flushFrame(options?: UpdateOptions): Promise<void>;
  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    hooks: Hook[],
    binding: ResumableBinding<TProps>,
  ): TResult;
  renderTemplate<TBinds, TPart extends Part>(
    template: Template<TBinds, TPart>,
    binds: TBinds,
  ): TemplateBlock<TBinds, TPart>;
  scheduleUpdate(
    binding: ResumableBinding<unknown>,
    options?: UpdateOptions,
  ): Promise<void>;
}

export interface DirectiveContext {
  resolveBinding<T>(value: Bindable<T>, part: Part): Binding<T>;
  resolveDirectiveElement<T>(
    value: Bindable<T>,
    part: Part,
  ): DirectiveElement<T>;
}

export function createDirectiveElement<T>(
  directive: Directive<T>,
  value: T,
): DirectiveElement<T> {
  return {
    directive,
    value,
    [bindableTag]: BindableType.Element,
  };
}

export function isDirectiveElement(
  value: unknown,
): value is DirectiveElement<unknown> {
  return (
    (value as DirectiveElement<unknown>)?.[bindableTag] === BindableType.Element
  );
}

export function isDirectiveObject(
  value: unknown,
): value is DirectiveObject<unknown> {
  return (
    (value as DirectiveObject<unknown>)?.[bindableTag] === BindableType.Object
  );
}
