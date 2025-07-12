import {
  type Binding,
  type CommitContext,
  type Component,
  type ComponentType,
  type Coroutine,
  type DirectiveContext,
  DirectiveSpecifier,
  type Effect,
  type RenderContext,
  type Slot,
  type UpdateContext,
} from '../directive.js';
import {
  ALL_LANES,
  type EffectHook,
  type Hook,
  HookType,
  type Lanes,
} from '../hook.js';
import { HydrationError, type HydrationTree } from '../hydration.js';
import type { Part } from '../part.js';
import { Scope } from '../scope.js';

export function component<TProps, TResult>(
  component: ComponentType<TProps, TResult>,
  props: NoInfer<TProps>,
): DirectiveSpecifier<TProps> {
  const directive = new FunctionComponent(component);
  return new DirectiveSpecifier(directive, props);
}

export class FunctionComponent<TProps, TResult>
  implements Component<TProps, TResult>
{
  private readonly _type: ComponentType<TProps, TResult>;

  constructor(type: ComponentType<TProps, TResult>) {
    this._type = type;
  }

  get displayName(): string {
    return this._type.name;
  }

  equals(other: unknown): boolean {
    return other instanceof FunctionComponent && other._type === this._type;
  }

  render(props: TProps, context: RenderContext): TResult {
    const type = this._type;
    return type(props, context);
  }

  shouldSkipUpdate(nextProps: TProps, prevProps: TProps): boolean {
    return (
      this._type.shouldSkipUpdate?.(nextProps, prevProps) ??
      nextProps === prevProps
    );
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
  implements Binding<TProps>, Coroutine
{
  private readonly _component: Component<TProps, TResult>;

  private _props: TProps;

  private _slot: Slot<TResult> | null = null;

  private readonly _part: Part;

  private _parentScope: Scope | null = null;

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

  get type(): Component<TProps, TResult> {
    return this._component;
  }

  get value(): TProps {
    return this._props;
  }

  get part(): Part {
    return this._part;
  }

  shouldBind(props: TProps): boolean {
    return (
      this._hooks.length === 0 ||
      !this._component.shouldSkipUpdate(props, this._props)
    );
  }

  bind(props: TProps): void {
    this._props = props;
  }

  resume(lanes: Lanes, context: UpdateContext): Lanes {
    const scope = new Scope(this._parentScope);
    const subcontext = context.enterScope(scope);
    const { value, pendingLanes } = subcontext.renderComponent(
      this._component,
      this._props,
      this._hooks,
      lanes,
      this,
    );
    if (this._slot !== null) {
      this._slot.reconcile(value, subcontext);
    } else {
      this._slot = subcontext.resolveSlot(value, this._part);
      this._slot.connect(subcontext);
    }
    return pendingLanes;
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    if (this._slot !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initilized.',
      );
    }

    const parentScope = context.getScope();
    const scope = new Scope(parentScope);
    const subcontext = context.enterScope(scope);
    const { value } = subcontext.renderComponent(
      this._component,
      this._props,
      this._hooks,
      ALL_LANES,
      this,
    );
    this._parentScope = parentScope;
    this._slot = subcontext.resolveSlot(value, this._part);
    this._slot.hydrate(hydrationTree, subcontext);
  }

  connect(context: UpdateContext): void {
    context.enqueueCoroutine(this);
    this._parentScope = context.getScope();
  }

  disconnect(context: UpdateContext): void {
    // Hooks must be cleaned in reverse order.
    for (let i = this._hooks.length - 1; i >= 0; i--) {
      const hook = this._hooks[i]!;
      switch (hook.type) {
        case HookType.Effect:
          context.enqueuePassiveEffect(new CleanEffectHook(hook));
          break;
        case HookType.LayoutEffect:
          context.enqueueLayoutEffect(new CleanEffectHook(hook));
          break;
        case HookType.InsertionEffect:
          context.enqueueMutationEffect(new CleanEffectHook(hook));
          break;
      }
    }

    this._slot?.disconnect(context);
    this._hooks = [];
  }

  commit(context: CommitContext): void {
    this._slot?.commit(context);
  }

  rollback(context: CommitContext): void {
    this._slot?.rollback(context);
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
