import {
  type Bindable,
  type Component,
  type ComponentFunction,
  type Coroutine,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type Effect,
  type RenderContext,
  type Slot,
  type UpdateContext,
  createDirectiveElement,
} from '../core.js';
import { type EffectHook, type Hook, HookType } from '../hook.js';
import type { Part } from '../part.js';

const componentDirectiveTag = Symbol('Component.directive');

export function component<TProps, TResult>(
  component: ComponentFunction<TProps, TResult>,
  props: TProps,
): DirectiveElement<TProps> {
  const directive = defineComponentDirective(component);
  return createDirectiveElement(directive, props);
}

export class ComponentDirective<TProps, TResult>
  implements Component<TProps, TResult>
{
  private readonly _component: ComponentFunction<TProps, TResult>;

  constructor(component: ComponentFunction<TProps, TResult>) {
    this._component = component;
  }

  get name(): string {
    return this._component.name;
  }

  render(props: TProps, context: RenderContext): Bindable<TResult> {
    const component = this._component;
    return component(props, context);
  }

  resolveBinding(
    props: TProps,
    part: Part,
    _context: DirectiveContext,
  ): ComponentBinding<TProps, TResult> {
    return new ComponentBinding(this, props, part);
  }
}

class ComponentBinding<TProps, TResult> implements Coroutine {
  private readonly _component: Component<TProps, TResult>;

  private _props: TProps;

  private _slot: Slot<TResult> | null = null;

  private readonly _part: Part;

  private _hooks: Hook[] = [];

  constructor(
    component: Component<TProps, TResult>,
    props: TProps,
    part: Part,
  ) {
    this._component = component;
    this._props = props;
    this._part = part;
  }

  get directive(): Component<TProps, TResult> {
    return this._component;
  }

  get value(): TProps {
    return this._props;
  }

  get part(): Part {
    return this._part;
  }

  shouldBind(props: TProps): boolean {
    return this._hooks.length === 0 || props !== this._props;
  }

  bind(props: TProps): void {
    this._props = props;
  }

  resume(context: UpdateContext): void {
    const result = context.renderComponent(
      this._component,
      this._props,
      this._hooks,
      this,
    );
    if (this._slot !== null) {
      this._slot.reconcile(result, context);
    } else {
      this._slot = context.resolveSlot(result, this._part);
      this._slot.connect(context);
    }
  }

  connect(context: UpdateContext): void {
    context.enqueueCoroutine(this);
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

    this._slot?.disconnect(context);
    this._hooks = [];
  }

  commit(): void {
    this._slot?.commit();
  }

  rollback(): void {
    this._slot?.rollback();
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
  component: ComponentFunction<TProps, TResult>,
): Directive<TProps> {
  return ((component as any)[componentDirectiveTag] ??= new ComponentDirective(
    component,
  ));
}
