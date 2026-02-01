import { DirectiveSpecifier } from './directive.js';
import {
  type Bindable,
  type Binding,
  type Component,
  type ComponentState,
  type Coroutine,
  createScope,
  createUpdateSession,
  DETACHED_SCOPE,
  type DirectiveContext,
  type Effect,
  type EffectQueue,
  type Hook,
  HookType,
  Lanes,
  type Part,
  type RenderContext,
  type Scope,
  type Slot,
  type UpdateSession,
} from './internal.js';

export interface ComponentOptions<TProps> {
  arePropsEqual?: (nextProps: TProps, prevProps: TProps) => boolean;
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
    });
  }

  Component.render = componentFn;
  Component.resolveBinding = resolveBinding;
  Component.arePropsEqual = options.arePropsEqual ?? Object.is;

  return Component;
}

export class ComponentBinding<TProps, TResult>
  implements Binding<TProps>, Coroutine
{
  private readonly _component: Component<TProps, TResult>;

  private _props: TProps;

  private readonly _part: Part;

  private _slot: Slot<TResult> | null = null;

  private readonly _state: ComponentState = {
    hooks: [],
    pendingLanes: Lanes.NoLanes,
    scope: DETACHED_SCOPE,
  };

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

  get pendingLanes(): Lanes {
    return this._state.pendingLanes;
  }

  get scope(): Scope {
    return this._state.scope;
  }

  resume(session: UpdateSession): void {
    const { scope } = this._state;
    const { frame, originScope, context } = session;
    const childScope = createScope(scope, this);
    const result = context.renderComponent(
      this._component,
      this._props,
      this._state,
      this,
      frame,
      childScope,
    );

    const childSession = createUpdateSession(
      frame,
      childScope,
      originScope,
      context,
    );
    let dirty: boolean;

    if (this._slot !== null) {
      dirty = this._slot.reconcile(result, childSession);
    } else {
      this._slot = context.resolveSlot(result, this._part);
      this._slot.attach(childSession);
      dirty = true;
    }

    if (
      dirty &&
      scope === originScope &&
      this._state.pendingLanes !== Lanes.NoLanes
    ) {
      frame.mutationEffects.push(this._slot, scope.level);
    }

    this._state.pendingLanes &= ~frame.lanes;
  }

  shouldUpdate(props: TProps): boolean {
    return (
      this._state.scope === DETACHED_SCOPE ||
      !this._component.arePropsEqual(props, this._props)
    );
  }

  attach(session: UpdateSession): void {
    const { frame, scope } = session;
    frame.pendingCoroutines.push(this);
    this._state.scope = scope;
  }

  detach(session: UpdateSession): void {
    const { frame } = session;

    // Cleanup effects follow the same declaration order within a component,
    // but must run from parent to child. Therefore, we collect cleanup effects
    // before all children are detached and then register them.
    for (const hook of this._state.hooks) {
      switch (hook.type) {
        case HookType.PassiveEffect:
          enqueueCleanEffectHook(hook, frame.passiveEffects);
          break;
        case HookType.LayoutEffect:
          enqueueCleanEffectHook(hook, frame.layoutEffects);
          break;
        case HookType.InsertionEffect:
          enqueueCleanEffectHook(hook, frame.mutationEffects);
          break;
      }
    }

    this._slot?.detach(session);

    this._state.pendingLanes = Lanes.NoLanes;
    this._state.scope = DETACHED_SCOPE;
  }

  commit(): void {
    this._slot?.commit();
  }

  rollback(): void {
    this._slot?.rollback();
  }
}

class CleanEffectHook implements Effect {
  private readonly _hook: Hook.EffectHook;

  private readonly _epoch: number;

  constructor(hook: Hook.EffectHook) {
    this._hook = hook;
    this._epoch = hook.epoch;
  }

  commit(): void {
    if (this._hook.epoch === this._epoch) {
      this._hook.cleanup?.();
      this._hook.cleanup = undefined;
      this._hook.epoch++;
    }
  }
}

function enqueueCleanEffectHook(
  hook: Hook.EffectHook,
  effects: EffectQueue,
): void {
  effects.pushBefore(new CleanEffectHook(hook));
}

function resolveBinding<TProps, TResult>(
  this: Component<TProps, TResult>,
  props: TProps,
  part: Part,
  _context: DirectiveContext,
): ComponentBinding<TProps, TResult> {
  return new ComponentBinding(this, props, part);
}
