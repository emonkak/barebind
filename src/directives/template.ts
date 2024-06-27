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
  type Effect,
  type Part,
  PartType,
  type TaskPriority,
  type Template,
  type TemplateFragment,
  type TemplateResult,
  type UpdateContext,
  type Updater,
} from '../types.js';

const FLAG_NONE = 0;
const FLAG_UPDATING = 1 << 0;
const FLAG_MUTATING = 1 << 1;
const FLAG_UNMOUNTING = 1 << 2;

export class TemplateDirective<TData, TContext = unknown>
  implements Directive<TContext>, TemplateResult<TData, TContext>
{
  private readonly _template: Template<TData, TContext>;

  private readonly _data: TData;

  constructor(template: Template<TData, TContext>, data: TData) {
    this._template = template;
    this._data = data;
  }

  get template(): Template<TData, TContext> {
    return this._template;
  }

  get data(): TData {
    return this._data;
  }

  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): TemplateBinding<TData, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error('TemplateDirective must be used in ChildNodePart.');
    }
    return new TemplateBinding(this, part, updater.getCurrentBlock());
  }
}

export class TemplateBinding<TData, TContext>
  implements
    Binding<TemplateDirective<TData, TContext>, TContext>,
    Effect,
    Block<TContext>
{
  private _directive: TemplateDirective<TData, TContext>;

  private readonly _part: ChildNodePart;

  private readonly _parent: Block<TContext> | null;

  private _pendingFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedTemplate: Template<TData, TContext> | null = null;

  private _priority: TaskPriority = 'background';

  private _flags = FLAG_NONE;

  constructor(
    directive: TemplateDirective<TData, TContext>,
    part: ChildNodePart,
    parent: Block<TContext> | null,
  ) {
    this._directive = directive;
    this._part = part;
    this._parent = parent;
  }

  get value(): TemplateDirective<TData, TContext> {
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
    return (this._flags & (FLAG_UPDATING | FLAG_MUTATING)) !== 0;
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

  requestUpdate(priority: TaskPriority, updater: Updater<TContext>): void {
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

  update(_context: UpdateContext<TContext>, updater: Updater<TContext>): void {
    if (!(this._flags & FLAG_UPDATING)) {
      return;
    }

    const { template, data } = this._directive;

    if (this._pendingFragment !== null) {
      if (this._memoizedTemplate!.isSameTemplate(template)) {
        this._pendingFragment.attach(data, updater);
      } else {
        // The template has been changed, so first, we detach data from the current
        // fragment.
        this._pendingFragment.detach(updater);

        // Next, unmount the old fragment and mount the new fragment.
        this._requestMutation(updater);

        // Finally, rehydrate the template.
        this._pendingFragment = template.hydrate(data, updater);
      }
    } else {
      // Mount the new fragment before the template hydration.
      this._requestMutation(updater);
      this._pendingFragment = template.hydrate(data, updater);
    }

    this._memoizedTemplate = template;
    this._flags &= ~FLAG_UPDATING;
  }

  connect(updater: Updater<TContext>): void {
    this._forceUpdate(updater);
  }

  bind(newValue: TemplateDirective<TData, TContext>, updater: Updater): void {
    DEBUG: {
      ensureDirective(TemplateDirective, newValue);
    }
    this._directive = newValue;
    this._forceUpdate(updater);
  }

  unbind(updater: Updater<TContext>): void {
    // Detach data from the current fragment before its unmount.
    this._pendingFragment?.detach(updater);
    this._requestMutation(updater);

    this._flags |= FLAG_UNMOUNTING;
    this._flags &= ~FLAG_UPDATING;
  }

  disconnect(): void {
    this._pendingFragment?.disconnect();
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
