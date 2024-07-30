import { ensureDirective, reportPart } from '../error.js';
import {
  type Binding,
  type Block,
  type ChildNodePart,
  type Effect,
  type Part,
  PartType,
  type TaskPriority,
  type Template,
  type TemplateDirective,
  type TemplateFragment,
  type UpdateContext,
  type UpdateHost,
  type Updater,
  comparePriorities,
  createUpdateContext,
  directiveTag,
  nameOf,
  nameTag,
} from '../types.js';

const FLAG_NONE = 0;
const FLAG_CONNECTED = 1 << 0;
const FLAG_UPDATING = 1 << 1;
const FLAG_MUTATING = 1 << 2;

export function templateResult<TData, TContext>(
  template: Template<TData, TContext>,
  data: TData,
): TemplateResult<TData, TContext> {
  return new TemplateResult(template, data);
}

export class TemplateResult<TData, TContext>
  implements TemplateDirective<TData, TContext>
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

  get [nameTag](): string {
    return 'TemplateResult(' + nameOf(this._template) + ')';
  }

  [directiveTag](
    part: Part,
    context: UpdateContext<TContext>,
  ): TemplateResultBinding<TData, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'TemplateResult directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new TemplateResultBinding(this, part, context.currentBlock);
  }
}

export class TemplateResultBinding<TData, TContext>
  implements
    Binding<TemplateResult<TData, TContext>, TContext>,
    Effect,
    Block<TContext>
{
  private _directive: TemplateResult<TData, TContext>;

  private readonly _part: ChildNodePart;

  private readonly _parent: Block<TContext> | null;

  private _pendingFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedTemplate: Template<TData, TContext> | null = null;

  private _flags = FLAG_NONE;

  private _priority: TaskPriority = 'user-blocking';

  constructor(
    directive: TemplateResult<TData, TContext>,
    part: ChildNodePart,
    parent: Block<TContext> | null,
  ) {
    this._directive = directive;
    this._part = part;
    this._parent = parent;
  }

  get value(): TemplateResult<TData, TContext> {
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

  get isUpdating(): boolean {
    return !!(this._flags & FLAG_UPDATING);
  }

  shouldUpdate(): boolean {
    if (!(this._flags & FLAG_UPDATING)) {
      return false;
    }
    let current: Block<TContext> | null = this;
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

  requestUpdate(
    priority: TaskPriority,
    host: UpdateHost<TContext>,
    updater: Updater<TContext>,
  ): void {
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
      updater.scheduleUpdate(host);
    }
  }

  update(host: UpdateHost<TContext>, updater: Updater<TContext>): void {
    const context = createUpdateContext(host, updater, this);
    const { template, data } = this._directive;

    if (this._memoizedTemplate?.isSameTemplate(template)) {
      // The fragment may have been unmounted. If so, we have to remount it.
      if (this._memoizedFragment !== this._pendingFragment) {
        this._requestMutation(updater);
      }

      // SAFETY: If there is a memoized template, the fragment will be present.
      this._pendingFragment!.bind(data, context);
    } else {
      // Here the template has been changed or has not been rendered yet. First,
      // we unbind data from the current fragment if the template has been
      // rendered.
      this._pendingFragment?.unbind(context);

      // Next, unmount the old fragment and mount the new fragment.
      this._requestMutation(updater);

      // Finally, render the new template.
      this._pendingFragment = template.render(data, context);
    }

    this._memoizedTemplate = template;
    this._flags &= ~FLAG_UPDATING;
  }

  connect(context: UpdateContext<TContext>): void {
    this._forceUpdate(context.updater);
  }

  bind(
    newValue: TemplateResult<TData, TContext>,
    context: UpdateContext<TContext>,
  ): void {
    DEBUG: {
      ensureDirective(TemplateResult, newValue, this._part);
    }
    this._directive = newValue;
    this._forceUpdate(context.updater);
  }

  unbind(context: UpdateContext<TContext>): void {
    // Detach data from the current fragment before its unmount.
    this._pendingFragment?.unbind(context);

    this._requestMutation(context.updater);

    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  disconnect(): void {
    this._pendingFragment?.disconnect();

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
