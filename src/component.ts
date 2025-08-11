import { shallowEqual } from './compare.js';
import {
  type Binding,
  type CommitContext,
  type Component,
  type Coroutine,
  type DirectiveContext,
  type Effect,
  type Hook,
  HookType,
  HydrationError,
  type HydrationTree,
  Lanes,
  type Part,
  type RenderContext,
  Scope,
  type Slot,
  type UpdateContext,
} from './core.js';
import { DirectiveSpecifier } from './directive.js';

export function component<TProps, TResult>(
  componentFn: ComponentFunction<TProps, TResult>,
  props: NoInfer<TProps>,
): DirectiveSpecifier<TProps> {
  const directive = new FunctionComponent(componentFn);
  return new DirectiveSpecifier(directive, props);
}

export function memo<TProps extends {}, TResult>(
  componentFn: ComponentFunction<TProps, TResult>,
  arePropsEqual: (
    nextProps: TProps,
    prevProps: TProps,
  ) => boolean = shallowEqual,
): ComponentFunction<TProps, TResult> {
  componentFn.shouldSkipUpdate = arePropsEqual;
  return componentFn;
}

export interface ComponentFunction<TProps, TResult = unknown> {
  (props: TProps, context: RenderContext): TResult;
  shouldSkipUpdate?(nextProps: TProps, prevProps: TProps): boolean;
}

export class FunctionComponent<TProps, TResult>
  implements Component<TProps, TResult>
{
  private readonly _componentFn: ComponentFunction<TProps, TResult>;

  constructor(componentFn: ComponentFunction<TProps, TResult>) {
    this._componentFn = componentFn;
  }

  get name(): string {
    return this._componentFn.name;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof FunctionComponent &&
      other._componentFn === this._componentFn
    );
  }

  render(props: TProps, context: RenderContext): TResult {
    const componentFn = this._componentFn;
    return componentFn(props, context);
  }

  shouldSkipUpdate(nextProps: TProps, prevProps: TProps): boolean {
    return (
      this._componentFn.shouldSkipUpdate?.(nextProps, prevProps) ??
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

  hydrate(tree: HydrationTree, context: UpdateContext): void {
    if (this._slot !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initilized.',
      );
    }

    const parentScope = context.getCurrentScope();
    const scope = new Scope(parentScope);
    const subcontext = context.enterScope(scope);
    const { value } = subcontext.renderComponent(
      this._component,
      this._props,
      this._hooks,
      Lanes.HydrationLane,
      this,
    );

    this._slot = subcontext.resolveSlot(value, this._part);
    this._slot.hydrate(tree, subcontext);
    this._parentScope = parentScope;
  }

  connect(context: UpdateContext): void {
    context.enqueueCoroutine(this);
    this._parentScope = context.getCurrentScope();
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
  private _hook: Hook.EffectHook;

  constructor(hook: Hook.EffectHook) {
    this._hook = hook;
  }

  commit(): void {
    this._hook.cleanup?.();
    this._hook.cleanup = undefined;
  }
}
