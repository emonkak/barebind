import type {
  Binding,
  Directive,
  EffectContext,
  UpdateContext,
} from '../coreTypes.js';
import type { Part } from '../part.js';

export interface Primitive<T> extends Directive<T> {
  ensureValue(value: unknown, part: Part): asserts value is T;
}

export const noValue: unique symbol = Symbol('noValue');

enum PrimitiveStatus {
  Idle,
  Mounting,
  Unmouting,
}

export abstract class PrimitiveBinding<TValue, TPart extends Part>
  implements Binding<TValue>
{
  private _pendingValue: TValue;

  protected _memoizedValue: TValue | typeof noValue = noValue;

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

  abstract shouldUpdate(newValue: TValue, oldValue: TValue): boolean;

  connect(): void {
    this._status = PrimitiveStatus.Mounting;
  }

  bind(value: TValue, _context: UpdateContext): void {
    if (
      this._memoizedValue === noValue ||
      this.shouldUpdate(this._pendingValue, this._memoizedValue)
    ) {
      this._status = PrimitiveStatus.Mounting;
    } else {
      this._status = PrimitiveStatus.Idle;
    }
    this._pendingValue = value;
  }

  unbind(_context: UpdateContext): void {
    if (this._memoizedValue !== null) {
      this._status = PrimitiveStatus.Unmouting;
    }
  }

  disconnect(_context: UpdateContext): void {
    this._status = PrimitiveStatus.Idle;
  }

  commit(_context: EffectContext): void {
    switch (this._status) {
      case PrimitiveStatus.Mounting:
        if (this._memoizedValue !== noValue) {
          this.update(this._pendingValue, this._memoizedValue, this._part);
        } else {
          this.mount(this._pendingValue, this._part);
        }
        this._memoizedValue = this._pendingValue;
        break;
      case PrimitiveStatus.Unmouting:
        this.unmount(this._pendingValue, this._part);
        this._memoizedValue = noValue;
        break;
    }
    this._status = PrimitiveStatus.Idle;
  }

  abstract mount(value: TValue, part: TPart): void;

  abstract unmount(value: TValue, part: TPart): void;

  abstract update(newValue: TValue, oldValue: TValue, part: TPart): void;
}
