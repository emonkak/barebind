import {
  type Binding,
  type ComponentFunction,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type Effect,
  type EffectContext,
  type UpdateContext,
  createDirectiveElement,
  resolveBindingTag,
} from './coreTypes.js';
import { type EffectHook, type Hook, HookType } from './hook.js';
import { type ChildNodePart, type Part, PartType } from './part.js';
import { SuspenseBinding } from './suspense.js';

export interface ComponentDirective<TProps>
  extends Directive<TProps>,
    ComponentFunction<TProps> {}

export function component<TProps>(
  component: ComponentFunction<TProps>,
  props: TProps,
): DirectiveElement<TProps> {
  treatComponentDirective(component);
  return createDirectiveElement(component, props);
}

export class ComponentBinding<TProps> implements Binding<TProps>, Effect {
  private readonly _component: ComponentDirective<TProps>;

  private _pendingProps: TProps;

  private _memoizedProps: TProps | null = null;

  private _binding: Binding<unknown> | null = null;

  private readonly _part: ChildNodePart;

  private _hooks: Hook[] = [];

  constructor(
    component: ComponentDirective<TProps>,
    props: TProps,
    part: ChildNodePart,
  ) {
    this._component = component;
    this._pendingProps = props;
    this._part = part;
  }

  get directive(): ComponentDirective<TProps> {
    return this._component;
  }

  get value(): TProps {
    return this._pendingProps;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  connect(context: UpdateContext): void {
    const element = context.renderComponent(
      this._component,
      this._pendingProps,
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
    if (props !== this._memoizedProps) {
      const element = context.renderComponent(
        this._component,
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
    }
    this._pendingProps = props;
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
    this._memoizedProps = this._pendingProps;
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

function resolveBinding<TProps>(
  this: ComponentDirective<TProps>,
  props: TProps,
  part: Part,
  _context: DirectiveContext,
): SuspenseBinding<TProps> {
  if (part.type !== PartType.ChildNode) {
    throw new Error('Component must be used in a child node part.');
  }
  return new SuspenseBinding(new ComponentBinding(this, props, part));
}

function treatComponentDirective<TProps>(
  component: ComponentFunction<TProps>,
): asserts component is ComponentDirective<TProps> {
  if (!(resolveBindingTag in component)) {
    Object.defineProperty(component, resolveBindingTag, {
      value: resolveBinding,
    });
  }
}
