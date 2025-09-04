import type { Binding, Part, Primitive, UpdateSession } from '../internal.js';

export abstract class PrimitiveBinding<TValue, TPart extends Part>
  implements Binding<TValue>
{
  value: TValue;

  readonly part: TPart;

  constructor(value: TValue, part: TPart) {
    this.value = value;
    this.part = part;
  }

  abstract get type(): Primitive<TValue>;

  abstract shouldBind(value: TValue): boolean;

  bind(value: TValue, _session: UpdateSession): void {
    this.value = value;
  }

  connect(_session: UpdateSession): void {}

  disconnect(_session: UpdateSession): void {}

  abstract commit(): void;

  abstract rollback(): void;
}
