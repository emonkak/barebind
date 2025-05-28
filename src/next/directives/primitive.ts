import type { Binding, Directive, UpdateContext } from '../directive.js';
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

  private _dirty = true;

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

  bind(value: TValue, _context: UpdateContext): boolean {
    this._pendingValue = value;
    return (
      this._memoizedValue === noValue ||
      this.shouldUpdate(value, this._memoizedValue)
    );
  }

  connect(_context: UpdateContext): void {
    this._dirty = true;
  }

  disconnect(_context: UpdateContext): void {
    this._dirty = true;
  }

  commit(): void {
    if (!this._dirty) {
      return;
    }
    this.mount();
    this._memoizedValue = this._pendingValue;
    this._dirty = false;
  }

  rollback(): void {
    if (!this._dirty) {
      return;
    }
    this.unmount();
    this._memoizedValue = noValue;
    this._dirty = false;
  }

  protected abstract mount(): void;

  protected abstract unmount(): void;
}
