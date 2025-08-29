import { DirectiveSpecifier } from './directive.js';
import {
  type Bindable,
  type Binding,
  type Component,
  type Coroutine,
  createScope,
  createUpdateContext,
  type DirectiveContext,
  type Effect,
  type Hook,
  HookType,
  HydrationError,
  type HydrationTree,
  Lanes,
  type Part,
  type RenderContext,
  type Scope,
  type Slot,
  type UpdateContext,
} from './internal.js';

export interface ComponentOptions<TProps> {
  shouldSkipUpdate?: (nextProps: TProps, prevProps: TProps) => boolean;
}

export function createComponent<TProps, TResult = unknown>(
  componentFn: (props: TProps, context: RenderContext) => TResult,
  options: ComponentOptions<TProps> = {},
): Component<TProps, TResult> {
  function Component(props: TProps): Bindable<TProps> {
    return new DirectiveSpecifier(
      Component as Component<TProps, TResult>,
      props,
    );
  }

  DEBUG: {
    Object.defineProperty(Component, 'name', {
      value: componentFn.name,
      configurable: true,
    });
  }

  Component.render = componentFn;
  Component.resolveBinding = resolveBinding;
  Component.shouldSkipUpdate =
    options.shouldSkipUpdate ?? defaultShouldSkipUpdate;

  return Component;
}

export class ComponentBinding<TProps, TResult>
  implements Binding<TProps>, Coroutine
{
  readonly type: Component<TProps, TResult>;

  value: TProps;

  part: Part;

  scope: Scope | null = null;

  pendingLanes: Lanes = Lanes.NoLanes;

  private _memoizedValue: TProps | null = null;

  private _slot: Slot<TResult> | null = null;

  private _hooks: Hook[] = [];

  constructor(
    component: Component<TProps, TResult>,
    props: TProps,
    part: Part,
  ) {
    this.type = component;
    this.value = props;
    this.part = part;
  }

  shouldBind(value: TProps): boolean {
    return (
      this._memoizedValue === null ||
      !this.type.shouldSkipUpdate(value, this._memoizedValue)
    );
  }

  resume(context: UpdateContext): void {
    const { frame, runtime } = context;
    const subscope = createScope(this.scope);
    const subcontext = createUpdateContext(frame, subscope, runtime);
    const result = runtime.renderComponent(
      this.type,
      this.value,
      this._hooks,
      this,
      frame,
      subscope,
    );
    let shouldCommit = frame.mutationEffects.length === 0;

    if (this._slot !== null) {
      if (!this._slot.reconcile(result, subcontext)) {
        shouldCommit = false;
      }
    } else {
      this._slot = runtime.resolveSlot(result, this.part);
      this._slot.connect(subcontext);
    }

    if (shouldCommit) {
      frame.mutationEffects.push(this._slot);
    }

    this.pendingLanes &= ~frame.lanes;
    this._memoizedValue = this.value;
  }

  hydrate(target: HydrationTree, context: UpdateContext): void {
    if (this._slot !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initialized.',
      );
    }

    const { frame, scope, runtime } = context;
    const subscope = createScope(scope);
    const subcontext = createUpdateContext(frame, subscope, runtime);
    const result = runtime.renderComponent(
      this.type,
      this.value,
      this._hooks,
      this,
      frame,
      subscope,
    );

    this._slot = runtime.resolveSlot(result, this.part);
    this._slot.hydrate(target, subcontext);

    this.scope = scope;
    this._memoizedValue = this.value;
  }

  connect(context: UpdateContext): void {
    context.frame.pendingCoroutines.push(this);
    this.scope = context.scope;
  }

  disconnect(context: UpdateContext): void {
    const { frame } = context;

    // Hooks must be cleaned in reverse order.
    for (let i = this._hooks.length - 1; i >= 0; i--) {
      const hook = this._hooks[i]!;
      switch (hook.type) {
        case HookType.Effect:
          frame.passiveEffects.push(new FinalizeEffectHook(hook));
          break;
        case HookType.LayoutEffect:
          frame.layoutEffects.push(new FinalizeEffectHook(hook));
          break;
        case HookType.InsertionEffect:
          frame.mutationEffects.push(new FinalizeEffectHook(hook));
          break;
      }
    }

    this._slot?.disconnect(context);

    this.pendingLanes = Lanes.NoLanes;
    this._hooks = [];
  }

  commit(): void {
    this._slot?.commit();
  }

  rollback(): void {
    this._slot?.rollback();
  }
}

class FinalizeEffectHook implements Effect {
  private _hook: Hook.EffectHook;

  constructor(hook: Hook.EffectHook) {
    this._hook = hook;
  }

  commit(): void {
    this._hook.cleanup?.();
    this._hook.cleanup = undefined;
  }
}

function defaultShouldSkipUpdate<TProps>(
  nextProps: TProps,
  prevProps: TProps,
): boolean {
  return nextProps === prevProps;
}

function resolveBinding<TProps, TResult>(
  this: Component<TProps, TResult>,
  props: TProps,
  part: Part,
  _context: DirectiveContext,
): ComponentBinding<TProps, TResult> {
  return new ComponentBinding(this, props, part);
}
