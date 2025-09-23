import { DirectiveSpecifier } from './directive.js';
import {
  type Bindable,
  type Binding,
  type Component,
  type Coroutine,
  createUpdateSession,
  type DirectiveContext,
  type Effect,
  type Hook,
  HookType,
  Lanes,
  type Part,
  type RenderContext,
  Scope,
  type Slot,
  type UpdateSession,
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
  private readonly _component: Component<TProps, TResult>;

  private _props: TProps;

  private readonly _part: Part;

  private _scope: Scope = Scope.DETACHED;

  private _pendingLanes: Lanes = Lanes.NoLanes;

  private _slot: Slot<TResult> | null = null;

  private readonly _hooks: Hook[] = [];

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

  set value(props: TProps) {
    this._props = props;
  }

  get part(): Part {
    return this._part;
  }

  get scope(): Scope {
    return this._scope;
  }

  get pendingLanes(): Lanes {
    return this._pendingLanes;
  }

  set pendingLanes(value: Lanes) {
    this._pendingLanes = value;
  }

  resume(session: UpdateSession): void {
    const { frame, rootScope, context } = session;
    const subScope = new Scope(this._scope);
    const subSession = createUpdateSession(frame, rootScope, subScope, context);
    const result = context.renderComponent(
      this._component,
      this._props,
      this._hooks,
      this,
      frame,
      subScope,
    );
    let dirty: boolean;

    if (this._slot !== null) {
      dirty = this._slot.reconcile(result, subSession);
    } else {
      this._slot = context.resolveSlot(result, this._part);
      this._slot.attach(subSession);
      dirty = true;
    }

    if (dirty && frame.mutationEffects.length === 0) {
      frame.mutationEffects.push(this._slot);
    }

    this._pendingLanes &= ~frame.lanes;
  }

  shouldUpdate(props: TProps): boolean {
    return (
      this._scope === Scope.DETACHED ||
      !this._component.shouldSkipUpdate(props, this._props)
    );
  }

  attach(session: UpdateSession): void {
    session.frame.pendingCoroutines.push(this);
    this._scope = session.scope;
  }

  detach(session: UpdateSession): void {
    const { frame } = session;

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

    this._slot?.detach(session);

    this._scope = Scope.DETACHED;
    this._pendingLanes = Lanes.NoLanes;
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
