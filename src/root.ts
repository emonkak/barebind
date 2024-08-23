import type {
  Binding,
  Block,
  DirectiveContext,
  Part,
  TaskPriority,
  UpdateContext,
} from './baseTypes.js';

const FLAG_NONE = 0;
const FLAG_DIRTY = 1 << 0;
const FLAG_CONNECTED = 1 << 1;
const FLAG_UPDATING = 1 << 2;

export class Root<TValue, TContext>
  implements Binding<TValue>, Block<TContext>
{
  private readonly _binding: Binding<TValue, TContext>;

  private readonly _parent: Block<TContext> | null;

  private _value: TValue;

  private _priority: TaskPriority = 'user-blocking';

  private _flags = FLAG_NONE;

  constructor(
    binding: Binding<TValue, TContext>,
    context: DirectiveContext<TContext>,
  ) {
    this._binding = binding;
    this._value = binding.value;
    this._parent = context.block;
  }

  get value(): TValue {
    return this._value;
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

  get parent(): Block<unknown> | null {
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

  get binding(): Binding<TValue> {
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
    context: UpdateContext<TContext>,
  ): void {
    if (
      this._flags & FLAG_CONNECTED &&
      (!(this._flags & FLAG_UPDATING) ||
        getPriorityNumber(priority) > getPriorityNumber(this._priority))
    ) {
      context.enqueueBlock(this);
      context.scheduleUpdate();

      this._priority = priority;
      this._flags |= FLAG_UPDATING;
    }
  }

  update(context: UpdateContext<TContext>): void {
    if (this._flags & FLAG_DIRTY) {
      this._binding.bind(this._value, context);
    } else {
      this._binding.connect(context);
    }

    this._flags |= FLAG_CONNECTED;
    this._flags &= ~(FLAG_DIRTY | FLAG_UPDATING);
  }

  connect(context: UpdateContext<TContext>): void {
    this._forceUpdate(context);
  }

  bind(newValue: TValue, context: UpdateContext<TContext>): void {
    this._forceUpdate(context);
    this._value = newValue;
    this._flags |= FLAG_DIRTY;
  }

  unbind(context: UpdateContext<TContext>): void {
    this._binding.unbind(context);

    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  disconnect(context: UpdateContext<TContext>): void {
    this._binding.disconnect(context);

    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  private _forceUpdate(context: UpdateContext): void {
    const priority = this._parent?.priority ?? 'user-blocking';

    if (
      !(this._flags & FLAG_UPDATING) ||
      getPriorityNumber(priority) > getPriorityNumber(this._priority)
    ) {
      context.enqueueBlock(this);

      this._priority = priority;
      this._flags |= FLAG_UPDATING;
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
