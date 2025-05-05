import type {
  Binding,
  Directive,
  EffectProtocol,
  UpdateProtocol,
} from '../coreTypes.js';
import type { Part } from '../part.js';

export interface Primitive<T> extends Directive<T> {
  ensureValue(value: unknown, part: Part): asserts value is T;
}

enum PrimitiveStatus {
  Idle,
  Mounting,
  Unmouting,
}

export abstract class PrimitiveBinding<TValue, TPart extends Part>
  implements Binding<TValue>
{
  private _pendingValue: TValue;

  protected _memoizedValue: TValue | null = null;

  private _part: TPart;

  private _status = PrimitiveStatus.Idle;

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

  connect(): void {
    this._status = PrimitiveStatus.Mounting;
  }

  bind(value: TValue, _context: UpdateProtocol): void {
    if (
      this._memoizedValue === null ||
      !Object.is(this._pendingValue, this._memoizedValue)
    ) {
      this._status = PrimitiveStatus.Mounting;
    }
    this._pendingValue = value;
  }

  unbind(_context: UpdateProtocol): void {
    if (this._memoizedValue !== null) {
      this._status = PrimitiveStatus.Unmouting;
    }
  }

  disconnect(_context: UpdateProtocol): void {
    this._status = PrimitiveStatus.Idle;
  }

  commit(_context: EffectProtocol): void {
    switch (this._status) {
      case PrimitiveStatus.Mounting:
        if (this._memoizedValue !== null) {
          this.update(this._pendingValue, this._memoizedValue, this._part);
        } else {
          this.mount(this._pendingValue, this._part);
        }
        this._memoizedValue = this._pendingValue;
        break;
      case PrimitiveStatus.Unmouting:
        this.unmount(this._pendingValue, this._part);
        this._memoizedValue = null;
        break;
    }
    this._status = PrimitiveStatus.Idle;
  }

  abstract mount(value: TValue, part: TPart): void;

  abstract unmount(value: TValue, part: TPart): void;

  abstract update(newValue: TValue, oldValue: TValue, part: TPart): void;
}
