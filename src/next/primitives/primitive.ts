import type { Binding, Directive, UpdateContext } from '../core.js';
import type { Part } from '../part.js';

export interface Primitive<T> extends Directive<T> {
  ensureValue(value: unknown, part: Part): asserts value is T;
}

export abstract class PrimitiveBinding<TValue, TPart extends Part>
  implements Binding<TValue>
{
  protected _pendingValue: TValue;

  protected readonly _part: TPart;

  constructor(value: TValue, part: TPart) {
    this._pendingValue = value;
    this._part = part;
  }

  abstract get directive(): Primitive<TValue>;

  get value(): TValue {
    return this._pendingValue;
  }

  get part(): TPart {
    return this._part;
  }

  abstract shouldBind(value: TValue): boolean;

  bind(value: TValue): void {
    this._pendingValue = value;
  }

  connect(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}

  abstract commit(): void;

  abstract rollback(): void;
}
