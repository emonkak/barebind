import {
  type Bindable,
  type Binding,
  type Component,
  type Coroutine,
  createScope,
  createUpdateSession,
  DETACHED_SCOPE,
  type DirectiveContext,
  type Effect,
  type EffectHandler,
  type EffectQueue,
  type Hook,
  HookType,
  Lane,
  type Lanes,
  type Part,
  type RenderContext,
  type Scope,
  type Slot,
  type UpdateSession,
} from './core.js';
import { DirectiveSpecifier } from './directive.js';

export interface ComponentOptions<TProps> {
  arePropsEqual?: (nextProps: TProps, prevProps: TProps) => boolean;
}

export function createComponent<TProps = {}, TResult = unknown>(
  render: (props: TProps, context: RenderContext) => TResult,
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
      value: render.name,
    });
  }

  Component.render = render;
  Component.resolveBinding = resolveBinding;
  Component.arePropsEqual = options.arePropsEqual ?? Object.is;

  return Component;
}

export class ComponentBinding<TProps, TResult>
  implements Binding<TProps>, Coroutine
{
  pendingLanes: Lanes = Lane.NoLane;

  private readonly _component: Component<TProps, TResult>;

  private _props: TProps;

  private readonly _part: Part;

  private _slot: Slot<TResult> | null = null;

  private _scope: Scope = DETACHED_SCOPE;

  private _pendingHooks: Hook[] = [];

  private _memoizedHooks: Hook[] = [];

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

  get name(): string {
    return this._component.name;
  }

  get scope(): Scope {
    return this._scope;
  }

  resume(session: UpdateSession): void {
    const { frame, coroutine, context } = session;
    const isRetrying = (this.pendingLanes & Lane.RetryLane) !== Lane.NoLane;
    const hooks = isRetrying
      ? this._pendingHooks.slice()
      : this._memoizedHooks.slice();
    const scope = createScope(this);

    const result = context.renderComponent(
      this._component,
      this._props,
      hooks,
      frame,
      scope,
      this,
    );

    const childSession = createUpdateSession(frame, scope, coroutine, context);

    if (this._slot !== null) {
      this._slot.reconcile(result, childSession);
    } else {
      this._slot = context.resolveSlot(result, this._part);
      this._slot.attach(childSession);
    }

    if (coroutine === this && !isRetrying) {
      frame.mutationEffects.push(this, scope.level);
    }

    this._pendingHooks = hooks;
  }

  shouldUpdate(props: TProps): boolean {
    return (
      this._scope === DETACHED_SCOPE ||
      !this._component.arePropsEqual(props, this._props)
    );
  }

  attach(session: UpdateSession): void {
    const { frame, scope } = session;
    frame.pendingCoroutines.push(this);
    this._scope = scope;
  }

  detach(session: UpdateSession): void {
    const { frame } = session;

    // Cleanup effects follow the same declaration order within a component,
    // but must run from parent to child. Therefore, we collect cleanup effects
    // before all children are detached and then register them.
    for (const hook of this._pendingHooks) {
      switch (hook.type) {
        case HookType.PassiveEffect:
          enqueueCleanupEffect(hook.handler, frame.passiveEffects);
          break;
        case HookType.LayoutEffect:
          enqueueCleanupEffect(hook.handler, frame.layoutEffects);
          break;
        case HookType.InsertionEffect:
          enqueueCleanupEffect(hook.handler, frame.mutationEffects);
          break;
      }
    }

    this._slot?.detach(session);
  }

  commit(): void {
    this._slot?.commit();
    this._memoizedHooks = this._pendingHooks;
  }

  rollback(): void {
    this._slot?.rollback();
    this._scope = DETACHED_SCOPE;
    this._memoizedHooks = [];
  }
}

class CleanupEffect implements Effect {
  private readonly _handler: EffectHandler;

  private readonly _epoch: number;

  constructor(handler: EffectHandler) {
    this._handler = handler;
    this._epoch = handler.epoch;
  }

  commit(): void {
    const { cleanup, epoch } = this._handler;

    if (epoch === this._epoch) {
      cleanup?.();
      this._handler.cleanup = undefined;
    }
  }
}

function enqueueCleanupEffect(
  handler: EffectHandler,
  effects: EffectQueue,
): void {
  handler.epoch++;
  effects.pushBefore(new CleanupEffect(handler));
}

function resolveBinding<TProps, TResult>(
  this: Component<TProps, TResult>,
  props: TProps,
  part: Part,
  _context: DirectiveContext,
): ComponentBinding<TProps, TResult> {
  return new ComponentBinding(this, props, part);
}
