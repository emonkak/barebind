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

  Component.displayName = componentFn.name;
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

  private _state: ComponentState = createComponentState();

  private _scope: Scope = DETACHED_SCOPE;

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
    return this._state.pendingLanes;
  }

  resume(session: UpdateSession): void {
    const { frame, rootScope, context } = session;
    const subScope = createScope(this._scope);
    const subSession = createUpdateSession(frame, subScope, rootScope, context);
    const result = context.renderComponent(
      this._component,
      this._props,
      this._state,
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

    if (
      dirty &&
      this._scope === rootScope &&
      this._state.pendingLanes !== Lanes.NoLanes
    ) {
      frame.mutationEffects.push(this._slot);
    }

    this._state.pendingLanes &= ~frame.lanes;
  }

  shouldUpdate(props: TProps): boolean {
    return (
      this._scope === DETACHED_SCOPE ||
      !this._component.arePropsEqual(props, this._props)
    );
  }

  attach(session: UpdateSession): void {
    session.frame.pendingCoroutines.push(this);
    this._scope = session.scope;
  }

  detach(session: UpdateSession): void {
    const { hooks } = this._state;
    const { frame } = session;

    this._slot?.detach(session);

    // Cleanup effects follow the same declaration order within a component,
    // but must run from parent to child. Therefore, we collect cleanup effects
    // after all children are detached and then register them.
    for (let i = hooks.length - 2; i >= 0; i--) {
      const hook = hooks[i]!;
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

    this._scope = DETACHED_SCOPE;
    this._state = createComponentState();
  }

  commit(): void {
    this._slot?.commit();
  }

  rollback(): void {
    this._slot?.rollback();
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

function createComponentState(): ComponentState {
  return {
    hooks: [],
    pendingLanes: Lanes.NoLanes,
  };
}

function enqueueCleanEffectHook(
  hook: Hook.EffectHook,
  effects: Effect[],
): void {
  effects.push(new CleanEffectHook(hook));
}

function resolveBinding<TProps, TResult>(
  this: Component<TProps, TResult>,
  props: TProps,
  part: Part,
  _context: DirectiveContext,
): ComponentBinding<TProps, TResult> {
  return new ComponentBinding(this, props, part);
}
