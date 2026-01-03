import type { Binding, Part, Primitive, UpdateSession } from '../internal.js';

export abstract class PrimitiveBinding<TValue, TPart extends Part>
  implements Binding<TValue>
{
  protected _value: TValue;

  protected readonly _part: TPart;

  constructor(value: TValue, part: TPart) {
    this._value = value;
    this._part = part;
  }

  abstract get type(): Primitive<TValue>;

  get value(): TValue {
    return this._value;
  }

  set value(value: TValue) {
    this._value = value;
  }

  get part(): TPart {
    return this._part;
  }

  abstract shouldUpdate(value: TValue): boolean;

  attach(_session: UpdateSession): void {}

  detach(_session: UpdateSession): void {}

  commit(): void {}

  rollback(): void {}
}
