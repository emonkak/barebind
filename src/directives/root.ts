import {
  type Binding,
  type Block,
  type Directive,
  type Part,
  type UpdateContext,
  directiveTag,
  nameOf,
  nameTag,
} from '../baseTypes.js';
import { resolveBinding } from '../binding.js';

const FLAG_NONE = 0;
const FLAG_DIRTY = 1 << 0;
const FLAG_CONNECTED = 1 << 1;
const FLAG_UPDATING = 1 << 2;

export function root<TValue>(value: TValue): Root<TValue> {
  return new Root(value);
}

export class Root<TValue> implements Directive {
  private _value: TValue;

  constructor(value: TValue) {
    this._value = value;
  }

  get value(): TValue {
    return this._value;
  }

  get [nameTag](): string {
    return 'Root(' + nameOf(this._value) + ')';
  }

  [directiveTag](
    part: Part,
    context: UpdateContext<unknown>,
  ): RootBinding<TValue> {
    return new RootBinding(this, part, context);
  }

  valueOf(): TValue {
    return this._value;
  }
}

export class RootBinding<TValue>
  implements Binding<Root<TValue>>, Block<unknown>
{
  protected _value: Root<TValue>;

  protected readonly _binding: Binding<TValue>;

  protected readonly _parent: Block<unknown> | null;

  private _priority: TaskPriority = 'user-blocking';

  private _flags = FLAG_NONE;

  constructor(
    value: Root<TValue>,
    part: Part,
    context: UpdateContext<unknown>,
  ) {
    this._value = value;
    this._binding = resolveBinding(value.value, part, context);
    this._parent = context.block;
  }

  get value(): Root<TValue> {
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
    let current: Block<unknown> | null = this;
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

  requestUpdate(priority: TaskPriority, context: UpdateContext<unknown>): void {
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

  update(context: UpdateContext<unknown>): void {
    if (this._flags & FLAG_DIRTY) {
      this._binding.bind(this._value.value, context);
    } else {
      this._binding.connect(context);
    }

    this._flags |= FLAG_CONNECTED;
    this._flags &= ~(FLAG_DIRTY | FLAG_UPDATING);
  }

  connect(context: UpdateContext<unknown>): void {
    this._forceUpdate(context);
  }

  bind(newValue: Root<TValue>, context: UpdateContext<unknown>): void {
    this._forceUpdate(context);
    this._value = newValue;
    this._flags |= FLAG_DIRTY;
  }

  unbind(context: UpdateContext<unknown>): void {
    this._binding.unbind(context);

    this._flags |= FLAG_DIRTY;
    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  disconnect(): void {
    this._binding.disconnect();

    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  private _forceUpdate(context: UpdateContext<unknown>): void {
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
