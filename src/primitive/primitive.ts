import type {
  Binding,
  CommitContext,
  HydrationNodeScanner,
  Part,
  Primitive,
  UpdateContext,
} from '../core.js';

export abstract class PrimitiveBinding<TValue, TPart extends Part>
  implements Binding<TValue>
{
  protected _pendingValue: TValue;

  protected readonly _part: TPart;

  constructor(value: TValue, part: TPart) {
    this._pendingValue = value;
    this._part = part;
  }

  abstract get type(): Primitive<TValue>;

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

  hydrate(_nodeScanner: HydrationNodeScanner, _context: UpdateContext): void {}

  connect(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}

  abstract commit(_context: CommitContext): void;

  abstract rollback(_context: CommitContext): void;
}
