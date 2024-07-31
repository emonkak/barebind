import {
  type Binding,
  type Block,
  type Part,
  type UpdateContext,
  type UpdateHost,
  type Updater,
  createUpdateContext,
} from './types.js';

const FLAG_NONE = 0;
const FLAG_CONNECTED = 1 << 0;
const FLAG_UPDATING = 1 << 1;

export class BlockBinding<TValue, TContext>
  implements Binding<TValue, TContext>, Block<TContext>
{
  protected readonly _binding: Binding<TValue>;

  protected readonly _parent: Block<TContext> | null;

  protected _pendingValue: TValue;

  private _priority: TaskPriority = 'user-blocking';

  private _flags = FLAG_NONE;

  constructor(binding: Binding<TValue>, parent: Block<TContext> | null) {
    this._binding = binding;
    this._parent = parent;
    this._pendingValue = binding.value;
  }

  get value(): TValue {
    return this._pendingValue;
  }

  get part(): Part {
    return this._binding.part;
  }

  get startNode(): ChildNode {
    return this._binding.startNode;
  }

  get endNode(): ChildNode {
    return this._binding.endNode;
  }

  get parent(): Block<TContext> | null {
    return this._parent;
  }

  get priority(): TaskPriority {
    return this._priority;
  }

  get isConnected(): boolean {
    return !!(this._flags & FLAG_CONNECTED);
  }

  get isUpdating(): boolean {
    return !!(this._flags & FLAG_UPDATING);
  }

  get binding(): Binding<TValue, TContext> {
    return this._binding;
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
    if (
      this._flags & FLAG_CONNECTED &&
      (!(this._flags & FLAG_UPDATING) ||
        getPriorityNumber(priority) > getPriorityNumber(this._priority))
    ) {
      this._priority = priority;
      this._flags |= FLAG_UPDATING;
      updater.enqueueBlock(this);
      updater.scheduleUpdate(host);
    }
  }

  update(host: UpdateHost<TContext>, updater: Updater<TContext>): void {
    const context = createUpdateContext(host, updater, this);
    if (this._flags & FLAG_CONNECTED) {
      this._binding.bind(this._pendingValue, context);
    } else {
      this._binding.connect(context);
    }
    this._flags |= FLAG_CONNECTED;
    this._flags &= ~FLAG_UPDATING;
  }

  connect(context: UpdateContext<TContext>): void {
    this._forceUpdate(context.updater);
  }

  bind(newValue: TValue, context: UpdateContext<TContext>): void {
    this._forceUpdate(context.updater);
    this._pendingValue = newValue;
  }

  unbind(context: UpdateContext<TContext>): void {
    this._binding.unbind(
      createUpdateContext(context.host, context.updater, this),
    );
    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  disconnect(): void {
    this._binding.disconnect();
    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  private _forceUpdate(updater: Updater<TContext>): void {
    const priority = this._parent?.priority ?? 'user-blocking';
    if (
      !(this._flags & FLAG_UPDATING) ||
      getPriorityNumber(priority) > getPriorityNumber(this._priority)
    ) {
      this._priority = priority;
      this._flags |= FLAG_UPDATING;
      updater.enqueueBlock(this);
    }
  }
}

function getPriorityNumber(priority: TaskPriority): number {
  switch (priority) {
    case 'user-blocking':
      return 2;
    case 'user-visible':
      return 1;
    case 'background':
      return 0;
  }
}
