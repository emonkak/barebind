import {
  type Binding,
  type ChildNodePart,
  type ComponentType,
  type Directive,
  type DirectiveContext,
  type Effect,
  type Hook,
  HookType,
  type Part,
  PartType,
  type Template,
  type TemplateFragment,
  type UpdateContext,
  directiveTag,
  nameOf,
  nameTag,
} from '../baseTypes.js';
import { ensureDirective, reportPart } from '../error.js';
import { Root } from '../root.js';

enum Status {
  Committed,
  Mounting,
  Unmounting,
}

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
  ): Root<Component<TProps, TData, TContext>, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'Component directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    // Component directive should be used with Root. Otherwise, updates will
    // begin from the parent block instead of the component itself.
    return new Root(new ComponentBinding(this, part), context);
  }
}

export class ComponentBinding<TProps, TData, TContext>
  implements Binding<Component<TProps, TData, TContext>, TContext>, Effect
{
  private _value: Component<TProps, TData, TContext>;

  private readonly _part: ChildNodePart;

  private _pendingFragment: TemplateFragment<unknown, TContext> | null = null;

  private _memoizedFragment: TemplateFragment<unknown, TContext> | null = null;

  private _memoizedTemplate: Template<unknown, TContext> | null = null;

  private _cachedFragments: WeakMap<
    Template<unknown, TContext>,
    TemplateFragment<unknown, TContext>
  > | null = null;

  private _hooks: Hook[] = [];

  private _status = Status.Committed;

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
    return this._memoizedFragment?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(context: UpdateContext<TContext>): void {
    this._triggerRender(this._value, context);
  }

  bind(
    newValue: Component<TProps, TData, TContext>,
    context: UpdateContext<TContext>,
  ): void {
    DEBUG: {
      ensureDirective(Component, newValue, this._part);
    }

    if (this._value.type !== newValue.type) {
      // The component type has been changed, so we need to clean hooks before
      // rendering.
      this._requestCleanHooks(context);
    }

    this._triggerRender(newValue, context);
    this._value = newValue;
  }

  unbind(context: UpdateContext<TContext>): void {
    this._pendingFragment?.unbind(context);

    this._requestCleanHooks(context);

    this._requestMutation(context, Status.Unmounting);
  }

  disconnect(): void {
    this._pendingFragment?.disconnect();

    cleanHooks(this._hooks);
    this._hooks = [];
  }

  commit(): void {
    switch (this._status) {
      case Status.Mounting:
        this._memoizedFragment?.unmount(this._part);
        this._pendingFragment?.mount(this._part);
        this._memoizedFragment = this._pendingFragment;
        break;
      case Status.Unmounting:
        this._memoizedFragment?.unmount(this._part);
        this._memoizedFragment = null;
        break;
    }

    this._status = Status.Committed;
  }

  private _triggerRender(
    component: Component<TProps, TData, TContext>,
    context: UpdateContext<TContext>,
  ) {
    const { type, props } = component;
    const { template, data } = context.renderComponent(
      type,
      props,
      this._hooks,
    );

    if (this._pendingFragment !== null) {
      // Safety: If a pending fragment exists, there will always be a memoized
      // template.
      if (this._memoizedTemplate!.isSameTemplate(template)) {
        // Here we use the same template as before. However the fragment may have
        // been unmounted. If so, we have to remount it.
        if (this._memoizedFragment !== this._pendingFragment) {
          this._requestMutation(context, Status.Mounting);
        }

        this._pendingFragment.bind(data, context);
      } else {
        // Here the template has been changed, so first, we unbind data from the current
        // fragment.
        this._pendingFragment.unbind(context);

        // Next, unmount the old fragment and mount the new fragment.
        this._requestMutation(context, Status.Mounting);

        let newFragment: TemplateFragment<TData, TContext>;

        // Finally, render the new template.
        if (this._cachedFragments !== null) {
          const cachedFragment = this._cachedFragments.get(template);
          if (cachedFragment !== undefined) {
            cachedFragment.bind(data, context);
            newFragment = cachedFragment;
          } else {
            newFragment = template.render(data, context);
            newFragment.connect(context);
          }
        } else {
          // It is rare that different templates are returned, so we defer
          // creating fragment caches.
          this._cachedFragments = new WeakMap();
          newFragment = template.render(data, context);
          newFragment.connect(context);
        }

        // Remember the previous fragment for future renderings.
        this._cachedFragments.set(
          this._memoizedTemplate!,
          this._pendingFragment,
        );

        this._pendingFragment = newFragment;
      }
    } else {
      // The template has never been rendered here. We have to mount the new
      // fragment before rendering the template. This branch will never be
      // executed unless bind() is called before connect().
      this._requestMutation(context, Status.Mounting);

      this._pendingFragment = template.render(data, context);
      this._pendingFragment.connect(context);
    }

    this._memoizedTemplate = template;
  }

  private _requestCleanHooks(context: UpdateContext<TContext>): void {
    if (this._hooks.length > 0) {
      context.enqueueLayoutEffect(new CleanHooks(this._hooks));
      this._hooks = [];
    }
  }

  private _requestMutation(
    context: UpdateContext<TContext>,
    newStatus: Status,
  ): void {
    if (this._status === Status.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._status = newStatus;
  }
}

function cleanHooks(hooks: Hook[]): void {
  for (let i = 0, l = hooks.length; i < l; i++) {
    const hook = hooks[i]!;
    if (hook.type === HookType.Effect) {
      hook.cleanup?.();
    }
  }
}

class CleanHooks implements Effect {
  private _hooks: Hook[];

  constructor(hooks: Hook[]) {
    this._hooks = hooks;
  }

  commit() {
    cleanHooks(this._hooks);
  }
}
