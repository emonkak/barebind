import type {
  Binding,
  CommitContext,
  Primitive,
  UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import type { Part } from '../part.js';

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

  hydrate(_hydrationTree: HydrationTree, _context: UpdateContext): void {}

  connect(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}

  abstract commit(_context: CommitContext): void;

  abstract rollback(_context: CommitContext): void;
}
