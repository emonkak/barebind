import {
  type Binding,
  type Component,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type Effect,
  type EffectContext,
  type UpdateContext,
  createDirectiveElement,
} from './coreTypes.js';
import { type EffectHook, type Hook, HookType } from './hook.js';
import type { Part } from './part.js';
import { SuspenseBinding } from './suspense.js';

const componentDirectiveTag = Symbol('Component.directive');

export function component<TProps, TResult>(
  component: Component<TProps, TResult>,
  props: TProps,
): DirectiveElement<TProps> {
  const directive = defineComponentDirective(component);
  return createDirectiveElement(directive, props);
}

class ComponentDirective<TProps, TResult> implements Directive<TProps> {
  constructor(readonly component: Component<TProps, TResult>) {}

  resolveBinding(
    props: TProps,
    part: Part,
    _context: DirectiveContext,
  ): SuspenseBinding<TProps> {
    return new SuspenseBinding(new ComponentBinding(this, props, part));
  }
}

class ComponentBinding<TProps, TResult> implements Binding<TProps>, Effect {
  private readonly _directive: ComponentDirective<TProps, TResult>;

  private _props: TProps;

  private _binding: Binding<TResult> | null = null;

  private readonly _part: Part;

  private _hooks: Hook[] = [];

  constructor(
    directive: ComponentDirective<TProps, TResult>,
    props: TProps,
    part: Part,
  ) {
    this._directive = directive;
    this._props = props;
    this._part = part;
  }

  get directive(): ComponentDirective<TProps, TResult> {
    return this._directive;
  }

  get value(): TProps {
    return this._props;
  }

  get part(): Part {
    return this._part;
  }

  connect(context: UpdateContext): void {
    const element = context.renderComponent(
      this._directive.component,
      this._props,
      this._hooks,
      this,
    );
    if (this._binding !== null) {
      this._binding = context.reconcileBinding(this._binding, element);
    } else {
      this._binding = context.resolveBinding(element, this._part);
      this._binding.connect(context);
    }
  }

  bind(props: TProps, context: UpdateContext): void {
    const element = context.renderComponent(
      this._directive.component,
      props,
      this._hooks,
      this,
    );
    if (this._binding !== null) {
      this._binding = context.reconcileBinding(this._binding, element);
    } else {
      this._binding = context.resolveBinding(element, this._part);
      this._binding.connect(context);
    }
    this._props = props;
  }

  unbind(context: UpdateContext): void {
    requestCleanHooks(this._hooks, context);
    this._binding?.unbind(context);
    this._hooks = [];
  }

  disconnect(context: UpdateContext): void {
    requestCleanHooks(this._hooks, context);
    this._binding?.disconnect(context);
    this._hooks = [];
  }

  commit(context: EffectContext): void {
    this._binding?.commit(context);
  }
}

class CleanEffectHook implements Effect {
  private _hook: EffectHook;

  constructor(hook: EffectHook) {
    this._hook = hook;
  }

  commit(): void {
    this._hook.cleanup?.();
    this._hook.cleanup = undefined;
  }
}

function defineComponentDirective<TProps, TResult>(
  component: Component<TProps, TResult>,
): Directive<TProps> {
  return ((component as any)[componentDirectiveTag] ??= new ComponentDirective(
    component,
  ));
}

function requestCleanHooks(hooks: Hook[], context: UpdateContext): void {
  // Hooks must be cleaned in reverse order.
  for (let i = hooks.length - 1; i >= 0; i--) {
    const hook = hooks[i]!;
    switch (hook.type) {
      case HookType.InsertionEffect:
        context.enqueueMutationEffect(new CleanEffectHook(hook));
        break;
      case HookType.LayoutEffect:
        context.enqueueLayoutEffect(new CleanEffectHook(hook));
        break;
      case HookType.PassiveEffect:
        context.enqueuePassiveEffect(new CleanEffectHook(hook));
        break;
    }
  }
}
