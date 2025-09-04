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

  get value(): TValue {
    return this._value;
  }

  get part(): TPart {
    return this._part;
  }

  abstract get type(): Primitive<TValue>;

  abstract shouldBind(value: TValue): boolean;

  bind(value: TValue, _session: UpdateSession): void {
    this._value = value;
  }

  connect(_session: UpdateSession): void {}

  disconnect(_session: UpdateSession): void {}

  abstract commit(): void;

  abstract rollback(): void;
}
