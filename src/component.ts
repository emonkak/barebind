import { DirectiveSpecifier } from './directive.js';
import {
  type Bindable,
  type Binding,
  type CommitContext,
  type Component,
  type Coroutine,
  createScope,
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
  private readonly _component: Component<TProps, TResult>;

  private _pendingProps: TProps;

  private _memoizedProps: TProps | null = null;

  private _slot: Slot<TResult> | null = null;

  private readonly _part: Part;

  private _hooks: Hook[] = [];

  private _pendingLanes: Lanes = Lanes.NoLanes;

  private _parentScope: Scope | null = null;

  constructor(
    component: Component<TProps, TResult>,
    props: TProps,
    part: Part,
  ) {
    this._component = component;
    this._pendingProps = props;
    this._part = part;
  }

  get type(): Component<TProps, TResult> {
    return this._component;
  }

  get value(): TProps {
    return this._pendingProps;
  }

  get part(): Part {
    return this._part;
  }

  get pendingLanes(): Lanes {
    return this._pendingLanes;
  }

  shouldBind(props: TProps): boolean {
    return (
      this._memoizedProps === null ||
      !this._component.shouldSkipUpdate(props, this._memoizedProps)
    );
  }

  bind(props: TProps): void {
    this._pendingProps = props;
  }

  resume(flushLanes: Lanes, context: UpdateContext): void {
    const scope = createScope(this._parentScope);
    const subcontext = context.enterScope(scope);
    const result = subcontext.renderComponent(
      this._component,
      this._pendingProps,
      flushLanes,
      this._hooks,
      this,
    );
    // When the scope level is the same, the binding is the update root.
    let shouldCommit = context.getCurrentScope().level === scope.level;

    if (this._slot !== null) {
      if (!this._slot.reconcile(result, subcontext)) {
        shouldCommit = false;
      }
    } else {
      this._slot = subcontext.resolveSlot(result, this._part);
      this._slot.connect(subcontext);
    }

    if (shouldCommit) {
      context.enqueueMutationEffect(this._slot);
    }

    this._pendingLanes &= ~flushLanes;
    this._memoizedProps = this._pendingProps;
  }

  suspend(scheduleLanes: Lanes, _context: UpdateContext): void {
    this._pendingLanes |= scheduleLanes;
  }

  hydrate(target: HydrationTree, context: UpdateContext): void {
    if (this._slot !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initialized.',
      );
    }

    const parentScope = context.getCurrentScope();
    const scope = createScope(parentScope);
    const subcontext = context.enterScope(scope);
    const result = subcontext.renderComponent(
      this._component,
      this._pendingProps,
      Lanes.NoLanes,
      this._hooks,
      this,
    );

    this._slot = subcontext.resolveSlot(result, this._part);
    this._slot.hydrate(target, subcontext);

    this._parentScope = parentScope;
    this._memoizedProps = this._pendingProps;
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
          context.enqueuePassiveEffect(new FinalizeEffectHook(hook));
          break;
        case HookType.LayoutEffect:
          context.enqueueLayoutEffect(new FinalizeEffectHook(hook));
          break;
        case HookType.InsertionEffect:
          context.enqueueMutationEffect(new FinalizeEffectHook(hook));
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
