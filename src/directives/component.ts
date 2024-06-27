import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import { comparePriorities } from '../scheduler.js';
import {
  type Block,
  type ChildNodePart,
  type Component,
  type Effect,
  type Hook,
  HookType,
  type Part,
  PartType,
  type TaskPriority,
  type Template,
  type TemplateFragment,
  type UpdateContext,
  type Updater,
} from '../types.js';

const FLAG_NONE = 0;
const FLAG_UPDATING = 1 << 0;
const FLAG_MUTATING = 1 << 1;
const FLAG_UNMOUNTING = 1 << 2;

export function component<TProps, TData, TContext>(
  component: Component<TProps, TData, TContext>,
  props: TProps,
): ComponentDirective<TProps, TData, TContext> {
  return new ComponentDirective(component, props);
}

export class ComponentDirective<TProps, TData, TContext>
  implements Directive<TContext>
{
  private readonly _component: Component<TProps, TData, TContext>;

  private readonly _props: TProps;

  constructor(component: Component<TProps, TData, TContext>, props: TProps) {
    this._component = component;
    this._props = props;
  }

  get component(): Component<TProps, TData, TContext> {
    return this._component;
  }

  get props(): TProps {
    return this._props;
  }

  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): ComponentBinding<TProps, TData, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error('ComponentDirective must be used in ChildNodePart.');
    }
    return new ComponentBinding(this, part, updater.getCurrentBlock());
  }
}

export class ComponentBinding<TProps, TData, TContext>
  implements
    Binding<ComponentDirective<TProps, TData, TContext>, TContext>,
    Effect,
    Block<TContext>
{
  private _directive: ComponentDirective<TProps, TData, TContext>;

  private readonly _part: ChildNodePart;

  private readonly _parent: Block<TContext> | null;

  private _pendingFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedComponent: Component<TProps, TData, TContext> | null = null;

  private _memoizedTemplate: Template<TData, TContext> | null = null;

  private _cachedFragments: WeakMap<
    Template<TData, TContext>,
    TemplateFragment<TData, TContext>
  > | null = null;

  private _hooks: Hook[] = [];

  private _priority: TaskPriority = 'background';

  private _flags = FLAG_NONE;

  constructor(
    directive: ComponentDirective<TProps, TData, TContext>,
    part: ChildNodePart,
    parent: Block<TContext> | null,
  ) {
    this._directive = directive;
    this._part = part;
    this._parent = parent;
  }

  get value(): ComponentDirective<TProps, TData, TContext> {
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

  get parent(): Block<TContext> | null {
    return this._parent;
  }

  get priority(): TaskPriority {
    return this._priority;
  }

  get dirty(): boolean {
    return !!(this._flags & FLAG_UPDATING || this._flags & FLAG_UNMOUNTING);
  }

  shouldUpdate(): boolean {
    if (!this.dirty) {
      return false;
    }
    let current: Block<TContext> | null = this;
    while ((current = current.parent) !== null) {
      if (current.dirty) {
        return false;
      }
    }
    return true;
  }

  requestUpdate(priority: TaskPriority, updater: Updater): void {
    if (
      !(this._flags & FLAG_UPDATING) ||
      comparePriorities(priority, this._priority) > 0
    ) {
      this._priority = priority;
      this._flags |= FLAG_UPDATING;
      updater.enqueueBlock(this);
      updater.scheduleUpdate();
    }

    this._flags &= ~FLAG_UNMOUNTING;
  }

  update(context: UpdateContext<TContext>, updater: Updater<TContext>): void {
    if (!(this._flags & FLAG_UPDATING)) {
      return;
    }

    const { component, props } = this._directive;

    if (
      this._memoizedComponent !== null &&
      this._memoizedComponent !== component
    ) {
      // The component has been changed, so we need to clean hooks.
      this._cleanHooks();
    }

    const { template, data } = context.renderComponent(
      component,
      props,
      this._hooks,
      this,
      updater,
    );

    if (this._pendingFragment !== null) {
      if (this._memoizedTemplate!.isSameTemplate(template)) {
        this._pendingFragment.attach(data, updater);
      } else {
        // The template has been changed, so first, we detach data from the current
        // fragment.
        this._pendingFragment.detach(updater);

        // Next, unmount the old fragment and mount the new fragment.
        this._requestMutation(updater);

        let newFragment: TemplateFragment<TData, TContext>;

        // Finally, rehydrate the template.
        if (this._cachedFragments !== null) {
          const cachedFragment = this._cachedFragments.get(template);
          if (cachedFragment !== undefined) {
            cachedFragment.attach(data, updater);
            newFragment = cachedFragment;
          } else {
            newFragment = template.hydrate(data, updater);
          }
        } else {
          // It is rare that different templates are returned, so we defer
          // creating fragment caches.
          this._cachedFragments = new WeakMap();
          newFragment = template.hydrate(data, updater);
        }

        // Remember the previous fragment for future renderings.
        this._cachedFragments.set(
          this._memoizedTemplate!,
          this._pendingFragment,
        );

        this._pendingFragment = newFragment;
      }
    } else {
      // Mount the new fragment before the template hydration.
      this._requestMutation(updater);
      this._pendingFragment = template.hydrate(data, updater);
    }

    this._memoizedComponent = component;
    this._memoizedTemplate = template;
    this._flags &= ~FLAG_UPDATING;
  }

  connect(updater: Updater): void {
    this._forceUpdate(updater);
  }

  bind(
    newValue: ComponentDirective<TProps, TData, TContext>,
    updater: Updater,
  ): void {
    DEBUG: {
      ensureDirective(ComponentDirective, newValue);
    }
    this._directive = newValue;
    this._forceUpdate(updater);
  }

  unbind(updater: Updater): void {
    this._pendingFragment?.detach(updater);
    this._cleanHooks();
    this._requestMutation(updater);

    this._flags |= FLAG_UNMOUNTING;
    this._flags &= ~FLAG_UPDATING;
  }

  disconnect(): void {
    this._pendingFragment?.disconnect();
    this._cleanHooks();
  }

  commit(): void {
    if (this._flags & FLAG_UNMOUNTING) {
      this._memoizedFragment?.unmount(this._part);
      this._memoizedFragment = null;
    } else {
      if (this._memoizedFragment !== this._pendingFragment) {
        this._memoizedFragment?.unmount(this._part);
        this._pendingFragment?.mount(this._part);
        this._memoizedFragment = this._pendingFragment;
      }
    }

    this._flags &= ~(FLAG_MUTATING | FLAG_UNMOUNTING);
  }

  private _cleanHooks(): void {
    const hooks = this._hooks;

    for (let i = 0, l = hooks.length; i < l; i++) {
      const hook = hooks[i]!;
      if (hook.type === HookType.Effect) {
        hook.cleanup?.();
      }
    }

    hooks.length = 0;
  }

  private _forceUpdate(updater: Updater<TContext>): void {
    if (!(this._flags & FLAG_UPDATING)) {
      this._priority = this._parent?.priority ?? updater.getCurrentPriority();
      this._flags |= FLAG_UPDATING;
      updater.enqueueBlock(this);
    }

    this._flags &= ~FLAG_UNMOUNTING;
  }

  private _requestMutation(updater: Updater<TContext>): void {
    if (!(this._flags & FLAG_MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= FLAG_MUTATING;
    }
  }
}
