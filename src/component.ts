import {
  type Binding,
  type Coroutine,
  Directive,
  type DirectiveContext,
  type Effect,
  type EffectQueue,
  type Lanes,
  Scope,
  type Session,
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
  function Component(props: TProps): Directive.Element<TProps> {
    return new Directive(Component, props);
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

export class ComponentBinding<TProps, TResult, TPart>
  implements Binding<TProps, TPart>, Coroutine
{
  pendingLanes: Lanes = NoLanes;

  private readonly _component: Component<TProps, TResult, TPart>;

  private _props: TProps;

  private readonly _part: TPart;

  private _scope: Scope = Scope.Orphan;

  private _memoizedSlot: Slot<TResult, TPart> | null = null;

  private _pendingHooks: Hook[] = [];

  private _currentHooks: Hook[] = [];

  constructor(
    component: Component<TProps, TResult, TPart>,
    props: TProps,
    part: TPart,
  ) {
    this._component = component;
    this._props = props;
    this._part = part;
  }

  get type(): Component<TProps, TResult, TPart> {
    return this._component;
  }

  get value(): TProps {
    return this._props;
  }

  set value(props: TProps) {
    this._props = props;
  }

  get part(): TPart {
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
      this._scope === Scope.Orphan ||
      !this._component.arePropsEqual(props, this._props)
    );
  }

  start(session: Session): void {
    const { frame, scope } = session;
    frame.coroutines.push(this);
    frame.mutationEffects.push(this, scope.level);
    this._pendingHooks = this._currentHooks;
  }

  resume(session: Session): void {
    const hooks = this._pendingHooks.slice();
    const scope = Scope.Child(this);

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

    const childSession: Session = { ...session, scope };

    if (this._memoizedSlot !== null) {
      this._memoizedSlot.update(result, childSession);
    } else {
      this._memoizedSlot = Slot.place(result, this._part, session.context);
      this._memoizedSlot.attach(childSession);
    }

    this._pendingHooks = hooks;
  }

  attach(session: Session): void {
    const { frame, scope } = session;
    frame.coroutines.push(this);
    this._scope = scope;
    this._pendingHooks = this._currentHooks;
  }

  detach(session: Session): void {
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

    this._memoizedSlot?.detach(session);
    this._scope = Scope.Orphan;
    this._pendingHooks = [];
  }

  commit(): void {
    this._memoizedSlot?.commit();
    this._currentHooks = this._pendingHooks;
  }

  rollback(): void {
    this._memoizedSlot?.rollback();
    this._currentHooks = [];
  }
}

class CleanupEffect implements Effect {
  private readonly _handler: EffectHandler;

  constructor(handler: EffectHandler) {
    this._handler = handler;
  }

  commit(): void {
    const { cleanup } = this._handler;
    cleanup?.();
    this._handler.cleanup = undefined;
  }
}

function enqueueCleanupEffect(
  handler: EffectHandler,
  effects: EffectQueue,
): void {
  handler.setup = null;
  effects.pushBefore(new CleanupEffect(handler));
}

function resolveBinding<TProps, TResult, TPart>(
  this: Component<TProps, TResult, TPart>,
  props: TProps,
  part: TPart,
  _context: DirectiveContext,
): ComponentBinding<TProps, TResult, TPart> {
  return new ComponentBinding(this, props, part);
}
