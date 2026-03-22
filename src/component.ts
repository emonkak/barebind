import {
  type Bindable,
  type Binding,
  type Coroutine,
  Directive,
  type DirectiveContext,
  type Effect,
  type EffectQueue,
  type Lanes,
  type Part,
  Scope,
  type UpdateSession,
} from './core.js';
import { NoLanes } from './lane.js';
import {
  type Component,
  type EffectHandler,
  HOOK_TYPE_INSERTION_EFFECT,
  HOOK_TYPE_LAYOUT_EFFECT,
  HOOK_TYPE_PASSIVE_EFFECT,
  type Hook,
  RenderContext,
} from './render-context.js';
import { Slot } from './slot.js';

export interface ComponentOptions<TProps> {
  arePropsEqual?: (nextProps: TProps, prevProps: TProps) => boolean;
}

export function createComponent<TProps = {}, TResult = unknown>(
  render: (props: TProps, context: RenderContext) => TResult,
  options: ComponentOptions<TProps> = {},
): Component<TProps, TResult> {
  function Component(props: TProps): Bindable<TProps> {
    return new Directive(Component as Component<TProps, TResult>, props);
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
  pendingLanes: Lanes = NoLanes;

  private readonly _component: Component<TProps, TResult>;

  private _props: TProps;

  private readonly _part: Part;

  private _slot: Slot<TResult> | null = null;

  private _scope: Scope = Scope.Detached;

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

  shouldUpdate(props: TProps): boolean {
    return (
      this._scope === Scope.Detached ||
      !this._component.arePropsEqual(props, this._props)
    );
  }

  start(session: UpdateSession): void {
    const { frame, scope } = session;
    frame.coroutines.push(this);
    frame.mutationEffects.push(this, scope.level);
    this._pendingHooks = this._memoizedHooks;
  }

  resume(session: UpdateSession): void {
    const hooks = this._pendingHooks.slice();
    const scope = new Scope(this);

    const component = this._component;
    const context = new RenderContext(
      hooks,
      session.frame,
      scope,
      this,
      session.context,
    );
    const result = component.render(this._props, context);

    context.finalize();

    const childSession: UpdateSession = { ...session, scope };

    if (this._slot !== null) {
      this._slot.reconcile(result, childSession);
    } else {
      this._slot = Slot.place(result, this._part, session.context);
      this._slot.attach(childSession);
    }

    this._pendingHooks = hooks;
  }

  attach(session: UpdateSession): void {
    const { frame, scope } = session;
    frame.coroutines.push(this);
    this._scope = scope;
    this._pendingHooks = this._memoizedHooks;
  }

  detach(session: UpdateSession): void {
    const { frame } = session;

    // Cleanup effects follow the same declaration order within a component,
    // but must run from parent to child. Therefore, we collect cleanup effects
    // before all children are detached and then register them.
    for (const hook of this._pendingHooks) {
      switch (hook.type) {
        case HOOK_TYPE_PASSIVE_EFFECT:
          enqueueCleanupEffect(hook.handler, frame.passiveEffects);
          break;
        case HOOK_TYPE_LAYOUT_EFFECT:
          enqueueCleanupEffect(hook.handler, frame.layoutEffects);
          break;
        case HOOK_TYPE_INSERTION_EFFECT:
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
    this._scope = Scope.Detached;
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
