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

export const noValue = Symbol('noValue');

export abstract class PrimitiveBinding<TValue, TPart extends Part>
  implements Binding<TValue>
{
  protected _pendingValue: TValue;

  protected _memoizedValue: TValue | typeof noValue = noValue;

  protected readonly _part: TPart;

  private _dirty = false;

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
    this._dirty = true;
  }

  bind(value: TValue, _context: UpdateContext): void {
    this._pendingValue = value;
    this._dirty ||=
      this._memoizedValue === noValue ||
      this.shouldUpdate(this._pendingValue, this._memoizedValue);
  }

  disconnect(_context: UpdateContext): void {}

  commit(_context: EffectContext): void {
    if (!this._dirty) {
      return;
    }
    this.mount();
    this._memoizedValue = this._pendingValue;
    this._dirty = false;
  }

  rollback(_context: EffectContext): void {
    this.unmount();
    this._memoizedValue = noValue;
    this._dirty = false;
  }

  protected abstract mount(): void;

  protected abstract unmount(): void;
}
