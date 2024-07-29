import { ensureDirective, reportPart } from '../error.js';
import {
  type Binding,
  type ChildNodePart,
  type ComponentFunction,
  type Directive,
  type Effect,
  type Hook,
  HookType,
  type Part,
  PartType,
  type TaskPriority,
  type Template,
  type TemplateFragment,
  type UpdateBlock,
  type UpdateHost,
  type Updater,
  comparePriorities,
  directiveTag,
  nameOf,
  nameTag,
} from '../types.js';

const FLAG_NONE = 0;
const FLAG_CONNECTED = 1 << 0;
const FLAG_UPDATING = 1 << 1;
const FLAG_MUTATING = 1 << 2;

export function component<TProps, TData, TContext>(
  component: ComponentFunction<TProps, TData, TContext>,
  props: TProps,
): Component<TProps, TData, TContext> {
  return new Component(component, props);
}

export class Component<TProps, TData, TContext> implements Directive<TContext> {
  private readonly _component: ComponentFunction<TProps, TData, TContext>;

  private readonly _props: TProps;

  constructor(
    component: ComponentFunction<TProps, TData, TContext>,
    props: TProps,
  ) {
    this._component = component;
    this._props = props;
  }

  get component(): ComponentFunction<TProps, TData, TContext> {
    return this._component;
  }

  get props(): TProps {
    return this._props;
  }

  get [nameTag](): string {
    return 'Component(' + nameOf(this._component) + ')';
  }

  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): ComponentBinding<TProps, TData, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'Component directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new ComponentBinding(this, part, updater.getCurrentBlock());
  }
}

export class ComponentBinding<TProps, TData, TContext>
  implements
    Binding<Component<TProps, TData, TContext>, TContext>,
    Effect,
    UpdateBlock<TContext>
{
  private _directive: Component<TProps, TData, TContext>;

  private readonly _part: ChildNodePart;

  private readonly _parent: UpdateBlock<TContext> | null;

  private _pendingFragment: TemplateFragment<unknown, TContext> | null = null;

  private _memoizedFragment: TemplateFragment<unknown, TContext> | null = null;

  private _memoizedComponent: ComponentFunction<
    TProps,
    TData,
    TContext
  > | null = null;

  private _memoizedTemplate: Template<unknown, TContext> | null = null;

  private _cachedFragments: WeakMap<
    Template<unknown, TContext>,
    TemplateFragment<unknown, TContext>
  > | null = null;

  private _hooks: Hook[] = [];

  private _flags = FLAG_NONE;

  private _priority: TaskPriority = 'user-blocking';

  constructor(
    directive: Component<TProps, TData, TContext>,
    part: ChildNodePart,
    parent: UpdateBlock<TContext> | null,
  ) {
    this._directive = directive;
    this._part = part;
    this._parent = parent;
  }

  get value(): Component<TProps, TData, TContext> {
    return this._directive;
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

  get parent(): UpdateBlock<TContext> | null {
    return this._parent;
  }

  get priority(): TaskPriority {
    return this._priority;
  }

  get isUpdating(): boolean {
    return !!(this._flags & FLAG_UPDATING);
  }

  shouldUpdate(): boolean {
    if (!(this._flags & FLAG_UPDATING)) {
      return false;
    }
    let current: UpdateBlock<TContext> | null = this;
    while ((current = current.parent) !== null) {
      if (current.isUpdating) {
        return false;
      }
    }
    return true;
  }

  cancelUpdate(): void {
    this._flags &= ~FLAG_UPDATING;
  }

  requestUpdate(priority: TaskPriority, updater: Updater): void {
    if (!(this._flags & FLAG_CONNECTED)) {
      return;
    }

    if (
      !(this._flags & FLAG_UPDATING) ||
      comparePriorities(priority, this._priority) > 0
    ) {
      this._flags |= FLAG_UPDATING;
      this._priority = priority;
      updater.enqueueBlock(this);
      updater.scheduleUpdate();
    }
  }

  performUpdate(host: UpdateHost<TContext>, updater: Updater<TContext>): void {
    const { component, props } = this._directive;

    if (
      this._memoizedComponent !== null &&
      this._memoizedComponent !== component
    ) {
      // The component has been changed, so we need to clean hooks.
      updater.enqueuePassiveEffect(new CleanHooks(this._hooks));
      this._hooks = [];
    }

    const { template, data } = host.renderComponent(
      component,
      props,
      this._hooks,
      this,
      updater,
    );

    if (this._pendingFragment !== null) {
      if (this._memoizedTemplate!.isSameTemplate(template)) {
        // The fragment may have been unmounted. If so, we have to remount it.
        if (this._memoizedFragment !== this._pendingFragment) {
          this._requestMutation(updater);
        }

        this._pendingFragment.bind(data, updater);
      } else {
        // The template has been changed, so first, we unbind data from the current
        // fragment.
        this._pendingFragment.unbind(updater);

        // Next, unmount the old fragment and mount the new fragment.
        this._requestMutation(updater);

        let newFragment: TemplateFragment<unknown, TContext>;

        // Finally, render the new template.
        if (this._cachedFragments !== null) {
          const cachedFragment = this._cachedFragments.get(template);
          if (cachedFragment !== undefined) {
            cachedFragment.bind(data, updater);
            newFragment = cachedFragment;
          } else {
            newFragment = template.render(data, updater);
          }
        } else {
          // It is rare that different templates are returned, so we defer
          // creating fragment caches.
          this._cachedFragments = new WeakMap();
          newFragment = template.render(data, updater);
        }

        // Remember the previous fragment for future renderings.
        this._cachedFragments.set(
          this._memoizedTemplate!,
          this._pendingFragment,
        );

        this._pendingFragment = newFragment;
      }
    } else {
      // We have to mount the new fragment before the template rendering.
      this._requestMutation(updater);

      this._pendingFragment = template.render(data, updater);
    }

    this._memoizedComponent = component;
    this._memoizedTemplate = template;
    this._flags &= ~FLAG_UPDATING;
  }

  connect(updater: Updater): void {
    this._forceUpdate(updater);
  }

  bind(newValue: Component<TProps, TData, TContext>, updater: Updater): void {
    DEBUG: {
      ensureDirective(Component, newValue, this._part);
    }
    this._directive = newValue;
    this._forceUpdate(updater);
  }

  unbind(updater: Updater): void {
    this._pendingFragment?.unbind(updater);

    cleanHooks(this._hooks);
    this._hooks = [];

    this._requestMutation(updater);

    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  disconnect(): void {
    this._pendingFragment?.disconnect();

    cleanHooks(this._hooks);
    this._hooks = [];

    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  commit(): void {
    if (this._flags & FLAG_CONNECTED) {
      if (this._memoizedFragment !== this._pendingFragment) {
        this._memoizedFragment?.unmount(this._part);
        this._pendingFragment?.mount(this._part);
        this._memoizedFragment = this._pendingFragment;
      }
    } else {
      this._memoizedFragment?.unmount(this._part);
      this._memoizedFragment = null;
    }

    this._flags &= ~FLAG_MUTATING;
  }

  private _forceUpdate(updater: Updater<TContext>): void {
    if (!(this._flags & FLAG_UPDATING)) {
      if (this._parent !== null) {
        this._priority = this._parent.priority;
      }
      this._flags |= FLAG_UPDATING;
      updater.enqueueBlock(this);
    }

    this._flags |= FLAG_CONNECTED;
  }

  private _requestMutation(updater: Updater<TContext>): void {
    if (!(this._flags & FLAG_MUTATING)) {
      this._flags |= FLAG_MUTATING;
      updater.enqueueMutationEffect(this);
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

function cleanHooks(hooks: Hook[]): void {
  for (let i = 0, l = hooks.length; i < l; i++) {
    const hook = hooks[i]!;
    if (hook.type === HookType.Effect) {
      hook.cleanup?.();
    }
  }
}
