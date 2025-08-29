import type {
  Binding,
  HydrationTree,
  Part,
  Primitive,
  UpdateContext,
} from '../internal.js';

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

  hydrate(_target: HydrationTree, _context: UpdateContext): void {}

  connect(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}

  abstract commit(): void;

  abstract rollback(): void;
}
