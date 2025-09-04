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
  private readonly _type: Component<TProps, TResult>;

  private _props: TProps;

  private readonly _part: Part;

  private _scope: Scope = Scope.DETACHED;

  private _pendingLanes: Lanes = Lanes.NoLanes;

  private _memoizedValue: TProps | null = null;

  private _slot: Slot<TResult> | null = null;

  private _hooks: Hook[] = [];

  constructor(
    component: Component<TProps, TResult>,
    props: TProps,
    part: Part,
  ) {
    this._type = component;
    this._props = props;
    this._part = part;
  }

  get type(): Component<TProps, TResult> {
    return this._type;
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
    const subscope = new Scope(this._scope);
    const subsession = createUpdateSession(frame, rootScope, subscope, context);
    const result = context.renderComponent(
      this._type,
      this._props,
      this._hooks,
      this,
      frame,
      subscope,
    );
    let shouldCommit = frame.mutationEffects.length === 0;

    if (this._slot !== null) {
      if (!this._slot.reconcile(result, subsession)) {
        shouldCommit = false;
      }
    } else {
      this._slot = context.resolveSlot(result, this._part);
      this._slot.connect(subsession);
    }

    if (shouldCommit) {
      frame.mutationEffects.push(this._slot);
    }

    this._pendingLanes &= ~frame.lanes;
    this._memoizedValue = this._props;
  }

  shouldBind(props: TProps): boolean {
    return (
      this._memoizedValue === null ||
      !this._type.shouldSkipUpdate(props, this._memoizedValue)
    );
  }

  connect(session: UpdateSession): void {
    session.frame.pendingCoroutines.push(this);
    this._scope = session.scope;
  }

  disconnect(session: UpdateSession): void {
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

    this._slot?.disconnect(session);

    this._scope = Scope.DETACHED;
    this._pendingLanes = Lanes.NoLanes;
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
