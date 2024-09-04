import {
  type Binding,
  type ChildNodePart,
  CommitStatus,
  type ComponentType,
  type Directive,
  type DirectiveContext,
  type Effect,
  type EffectHook,
  type Hook,
  HookType,
  type Part,
  PartType,
  type Template,
  type TemplateView,
  type UpdateContext,
  directiveTag,
  nameOf,
  nameTag,
} from '../baseTypes.js';
import { BlockBinding } from '../binding/block.js';
import { ensureDirective, reportPart } from '../error.js';

export function component<TProps, TData, TContext>(
  component: ComponentType<TProps, TData, TContext>,
  props: TProps,
): Component<TProps, TData, TContext> {
  return new Component(component, props);
}

export class Component<TProps, TData, TContext>
  implements Directive<Component<TProps, TData, TContext>, TContext>
{
  private readonly _type: ComponentType<TProps, TData, TContext>;

  private readonly _props: TProps;

  constructor(type: ComponentType<TProps, TData, TContext>, props: TProps) {
    this._type = type;
    this._props = props;
  }

  get type(): ComponentType<TProps, TData, TContext> {
    return this._type;
  }

  get props(): TProps {
    return this._props;
  }

  get [nameTag](): string {
    return 'Component(' + nameOf(this._type) + ')';
  }

  [directiveTag](
    part: Part,
    context: DirectiveContext,
  ): BlockBinding<Component<TProps, TData, TContext>, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'Component directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    // Component directive should be used with BlockBinding. Otherwise, updates
    // will begin from the parent block instead of the component itself.
    return new BlockBinding(new ComponentBinding(this, part), context.block);
  }
}

export class ComponentBinding<TProps, TData, TContext>
  implements Binding<Component<TProps, TData, TContext>, TContext>, Effect
{
  private _value: Component<TProps, TData, TContext>;

  private readonly _part: ChildNodePart;

  private _pendingView: TemplateView<unknown, TContext> | null = null;

  private _memoizedView: TemplateView<unknown, TContext> | null = null;

  private _memoizedTemplate: Template<unknown, TContext> | null = null;

  private _cachedViews: WeakMap<
    Template<unknown, TContext>,
    TemplateView<unknown, TContext>
  > | null = null;

  private _hooks: Hook[] = [];

  private _status = CommitStatus.Committed;

  constructor(value: Component<TProps, TData, TContext>, part: ChildNodePart) {
    this._value = value;
    this._part = part;
  }

  get value(): Component<TProps, TData, TContext> {
    return this._value;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._memoizedView?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(context: UpdateContext<TContext>): void {
    this._performRender(this._value, context);
  }

  bind(
    newValue: Component<TProps, TData, TContext>,
    context: UpdateContext<TContext>,
  ): void {
    DEBUG: {
      ensureDirective([Component], newValue, this._part);
    }

    if (this._value.type !== newValue.type) {
      // The component type has been changed, so we need to clean hooks before
      // rendering.
      this._requestCleanHooks(context);
    }

    this._performRender(newValue, context);
    this._value = newValue;
  }

  unbind(context: UpdateContext<TContext>): void {
    this._pendingView?.unbind(context);
    this._requestCleanHooks(context);
    if (this._memoizedView !== null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  disconnect(context: UpdateContext<TContext>): void {
    this._pendingView?.disconnect(context);
    this._requestCleanHooks(context);
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting:
        this._memoizedView?.unmount(this._part);
        this._pendingView?.mount(this._part);
        this._memoizedView = this._pendingView;
        break;
      case CommitStatus.Unmounting:
        this._memoizedView?.unmount(this._part);
        this._memoizedView = null;
        break;
    }

    this._status = CommitStatus.Committed;
  }

  private _performRender(
    component: Component<TProps, TData, TContext>,
    context: UpdateContext<TContext>,
  ) {
    const { type, props } = component;
    const { template, data } = context.render(type, props, this._hooks);

    if (this._pendingView !== null) {
      // Safety: If a pending view exists, there will always be a memoized
      // template.
      if (this._memoizedTemplate!.isSameTemplate(template)) {
        // Here we use the same template as before. However the view may have
        // been unmounted. If so, we have to remount it.
        if (this._memoizedView !== this._pendingView) {
          this._requestCommit(context);
          this._status = CommitStatus.Mounting;
        }

        this._pendingView.bind(data, context);
      } else {
        // Here the template has been changed, so first, we unbind data from the
        // current view.
        this._pendingView.unbind(context);

        // Next, unmount the old view and mount the new view.
        this._requestCommit(context);
        this._status = CommitStatus.Mounting;

        let newView: TemplateView<TData, TContext>;

        // Finally, render the new template.
        if (this._cachedViews !== null) {
          const cachedView = this._cachedViews.get(template);
          if (cachedView !== undefined) {
            cachedView.bind(data, context);
            newView = cachedView;
          } else {
            newView = template.render(data, context);
            newView.connect(context);
          }
        } else {
          // It is rare that different templates are returned, so we defer
          // creating view caches.
          this._cachedViews = new WeakMap();
          newView = template.render(data, context);
          newView.connect(context);
        }

        // Remember the previous view for future renderings.
        this._cachedViews.set(this._memoizedTemplate!, this._pendingView);

        this._pendingView = newView;
      }
    } else {
      // The template has never been rendered here. We have to mount the new
      // view before rendering the template. This branch will never be executed
      // unless bind() is called before connect().
      this._requestCommit(context);
      this._status = CommitStatus.Mounting;

      this._pendingView = template.render(data, context);
      this._pendingView.connect(context);
    }

    this._memoizedTemplate = template;
  }

  private _requestCleanHooks(context: UpdateContext<TContext>): void {
    // Clean hooks in reverse order.
    for (let i = this._hooks.length - 1; i >= 0; i--) {
      const hook = this._hooks[i]!;
      switch (hook.type) {
        case HookType.InsertionEffect:
          context.enqueueMutationEffect(new CleanEffectHook(hook));
          break;
        case HookType.LayoutEffect:
          context.enqueueLayoutEffect(new CleanEffectHook(hook));
          break;
        case HookType.PassiveEffect:
          context.enqueuePassiveEffect(new CleanEffectHook(hook));
          break;
      }
    }
    this._hooks = [];
  }

  private _requestCommit(context: UpdateContext<TContext>): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
  }
}

class CleanEffectHook implements Effect {
  private _hook: EffectHook;

  constructor(hook: EffectHook) {
    this._hook = hook;
  }

  commit(): void {
    this._hook.cleanup?.();
    this._hook.cleanup = undefined;
  }
}
