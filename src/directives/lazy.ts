import { resolveBinding } from '../binding.js';
import {
  type Binding,
  type Block,
  type Directive,
  type Part,
  type UpdateContext,
  type UpdateHost,
  type Updater,
  directiveTag,
  nameOf,
  nameTag,
} from '../types.js';

const FLAG_NONE = 0;
const FLAG_CONNECTED = 1 << 0;
const FLAG_UPDATING = 1 << 1;

export function lazy<TValue>(value: TValue): Lazy<TValue> {
  return new Lazy(value);
}

export class Lazy<TValue> implements Directive {
  private _value: TValue;

  constructor(value: TValue) {
    this._value = value;
  }

  get value(): TValue {
    return this._value;
  }

  get [nameTag](): string {
    return 'Lazy(' + nameOf(this._value) + ')';
  }

  [directiveTag](
    part: Part,
    context: UpdateContext<unknown>,
  ): LazyBinding<TValue> {
    return new LazyBinding(this, part, context);
  }

  valueOf(): TValue {
    return this._value;
  }
}

export class LazyBinding<TValue>
  implements Binding<Lazy<TValue>>, Block<unknown>
{
  protected _value: Lazy<TValue>;

  protected readonly _binding: Binding<TValue>;

  protected readonly _parent: Block<unknown> | null;

  private _priority: TaskPriority = 'user-blocking';

  private _flags = FLAG_NONE;

  constructor(
    value: Lazy<TValue>,
    part: Part,
    context: UpdateContext<unknown>,
  ) {
    this._value = value;
    this._binding = resolveBinding(value.value, part, context);
    this._parent = context.block;
  }

  get value(): Lazy<TValue> {
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

  requestUpdate(
    priority: TaskPriority,
    host: UpdateHost<unknown>,
    updater: Updater<unknown>,
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

  update(host: UpdateHost<unknown>, updater: Updater<unknown>): void {
    const internalContext = { host, updater, block: this };
    if (this._flags & FLAG_CONNECTED) {
      this._binding.bind(this._value.value, internalContext);
    } else {
      this._binding.connect(internalContext);
    }
    this._flags |= FLAG_CONNECTED;
    this._flags &= ~FLAG_UPDATING;
  }

  connect(context: UpdateContext<unknown>): void {
    this._forceUpdate(context.updater);
  }

  bind(newValue: Lazy<TValue>, context: UpdateContext<unknown>): void {
    this._forceUpdate(context.updater);
    this._value = newValue;
  }

  unbind(context: UpdateContext<unknown>): void {
    const internalContext = {
      host: context.host,
      updater: context.updater,
      block: this,
    };
    this._binding.unbind(internalContext);
    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  disconnect(): void {
    this._binding.disconnect();
    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  private _forceUpdate(updater: Updater<unknown>): void {
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
