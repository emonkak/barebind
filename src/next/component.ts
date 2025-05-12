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
  readonly component: Component<TProps, TResult>;

  constructor(component: Component<TProps, TResult>) {
    this.component = component;
  }

  get name(): string {
    return this.component.name;
  }

  resolveBinding(
    props: TProps,
    part: Part,
    _context: DirectiveContext,
  ): SuspenseBinding<TProps> {
    return new SuspenseBinding(new ComponentBinding(this, props, part));
  }
}

const enum ComponentStatus {
  Idle,
  Mounting,
  Unmounting,
}

class ComponentBinding<TProps, TResult> implements Binding<TProps>, Effect {
  private readonly _directive: ComponentDirective<TProps, TResult>;

  private _pendingProps: TProps;

  private _memoizedProps: TProps | null = null;

  private _pendingBinding: Binding<TResult> | null = null;

  private _memoizedBinding: Binding<TResult> | null = null;

  private readonly _part: Part;

  private _hooks: Hook[] = [];

  private _status = ComponentStatus.Idle;

  constructor(
    directive: ComponentDirective<TProps, TResult>,
    props: TProps,
    part: Part,
  ) {
    this._directive = directive;
    this._pendingProps = props;
    this._part = part;
  }

  get directive(): ComponentDirective<TProps, TResult> {
    return this._directive;
  }

  get value(): TProps {
    return this._pendingProps;
  }

  get part(): Part {
    return this._part;
  }

  connect(context: UpdateContext): void {
    const element = context.renderComponent(
      this._directive.component,
      this._pendingProps,
      this._hooks,
      this,
    );
    if (this._pendingBinding !== null) {
      this._pendingBinding = context.reconcileBinding(
        this._pendingBinding,
        element,
      );
    } else {
      this._pendingBinding = context.resolveBinding(element, this._part);
      this._pendingBinding.connect(context);
    }
    this._status = ComponentStatus.Mounting;
  }

  bind(props: TProps, context: UpdateContext): void {
    if (props !== this._memoizedProps) {
      const element = context.renderComponent(
        this._directive.component,
        props,
        this._hooks,
        this,
      );
      if (this._pendingBinding !== null) {
        this._pendingBinding = context.reconcileBinding(
          this._pendingBinding,
          element,
        );
      } else {
        this._pendingBinding = context.resolveBinding(element, this._part);
        this._pendingBinding.connect(context);
      }
      this._status = ComponentStatus.Mounting;
    } else {
      this._status = ComponentStatus.Idle;
    }
    this._pendingProps = props;
  }

  unbind(context: UpdateContext): void {
    requestCleanHooks(this._hooks, context);
    this._memoizedBinding?.unbind(context);
    this._hooks = [];
    this._status = ComponentStatus.Unmounting;
  }

  disconnect(context: UpdateContext): void {
    requestCleanHooks(this._hooks, context);
    this._memoizedBinding?.disconnect(context);
    this._hooks = [];
    this._status = ComponentStatus.Idle;
  }

  commit(context: EffectContext): void {
    switch (this._status) {
      case ComponentStatus.Mounting:
        if (this._memoizedBinding !== this._pendingBinding) {
          this._memoizedBinding?.commit(context);
        }
        this._pendingBinding?.commit(context);
        this._memoizedProps = this._pendingProps;
        this._memoizedBinding = this._pendingBinding;
        break;
      case ComponentStatus.Unmounting:
        this._memoizedBinding?.commit(context);
        this._memoizedProps = null;
        this._memoizedBinding = null;
        break;
    }
    this._status = ComponentStatus.Idle;
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
