import {
  type Binding,
  type Component,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type Effect,
  type ResumableBinding,
  type UpdateContext,
  createDirectiveElement,
} from '../directive.js';
import { type EffectHook, type Hook, HookType } from '../hook.js';
import type { Part } from '../part.js';

const componentDirectiveTag = Symbol('Component.directive');

export function component<TProps, TResult>(
  component: Component<TProps, TResult>,
  props: TProps,
): DirectiveElement<TProps> {
  const directive = defineComponentDirective(component);
  return createDirectiveElement(directive, props);
}

class ComponentDirective<TProps, TResult> implements Directive<TProps> {
  private readonly _component: Component<TProps, TResult>;

  constructor(component: Component<TProps, TResult>) {
    this._component = component;
  }

  get name(): string {
    return this._component.name;
  }

  get component(): Component<TProps, TResult> {
    return this._component;
  }

  resolveBinding(
    props: TProps,
    part: Part,
    _context: DirectiveContext,
  ): ComponentBinding<TProps, TResult> {
    return new ComponentBinding(this, props, part);
  }
}

export class ComponentBinding<TProps, TResult>
  implements ResumableBinding<TProps>
{
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

  resume(context: UpdateContext): void {
    const result = context.renderComponent(
      this._directive.component,
      this._props,
      this._hooks,
      this,
    );
    if (this._binding !== null) {
      this._binding.bind(result, context);
    } else {
      this._binding = context.resolveBinding(result, this._part);
    }
    this._binding.connect(context);
  }

  shouldBind(props: TProps): boolean {
    return this._props === props;
  }

  bind(props: TProps, _context: UpdateContext): void {
    this._props = props;
  }

  connect(context: UpdateContext): void {
    context.enqueueBinding(this);
  }

  disconnect(context: UpdateContext): void {
    // Hooks must be cleaned in reverse order.
    for (let i = this._hooks.length - 1; i >= 0; i--) {
      const hook = this._hooks[i]!;
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

    this._binding?.disconnect(context);
    this._hooks = [];
  }

  commit(): void {
    this._binding?.commit();
  }

  rollback(): void {
    this._binding?.rollback();
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
