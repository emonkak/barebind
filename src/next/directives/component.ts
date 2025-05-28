import {
  type Binding,
  type Component,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type Effect,
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

class ComponentBinding<TProps, TResult> implements Binding<TProps>, Effect {
  private readonly _directive: ComponentDirective<TProps, TResult>;

  private _props: TProps;

  private _pendingBinding: Binding<TResult> | null = null;

  private _memoizedBinding: Binding<TResult> | null = null;

  private readonly _part: Part;

  private _hooks: Hook[] = [];

  private _dirty = false;

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

  bind(props: TProps, _context: UpdateContext): boolean {
    const dirty = this._props !== props;
    this._props = props;
    return dirty;
  }

  connect(context: UpdateContext): void {
    if (this._dirty) {
      const result = context.renderComponent(
        this._directive.component,
        this._props,
        this._hooks,
        this,
      );
      if (this._pendingBinding !== null) {
        this._pendingBinding = context.reconcileBinding(
          this._pendingBinding,
          result,
        );
      } else {
        this._pendingBinding = context.resolveBinding(result, this._part);
        this._pendingBinding.connect(context);
      }
    } else {
      context.enqueueBinding(this);
      this._dirty = true;
    }
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

    this._pendingBinding?.disconnect(context);
    this._hooks = [];
    this._dirty = true;
  }

  commit(): void {
    if (!this._dirty) {
      return;
    }
    if (this._memoizedBinding !== this._pendingBinding) {
      this._memoizedBinding?.rollback();
    }
    this._pendingBinding?.commit();
    this._memoizedBinding = this._pendingBinding;
    this._dirty = false;
  }

  rollback(): void {
    if (!this._dirty) {
      return;
    }
    this._memoizedBinding?.rollback();
    this._memoizedBinding = null;
    this._dirty = false;
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
