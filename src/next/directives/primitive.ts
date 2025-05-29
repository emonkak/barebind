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
    const dirty =
      this._memoizedValue === noValue ||
      this.shouldUpdate(value, this._memoizedValue);
    this._pendingValue = value;
    return dirty;
  }

  connect(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}

  commit(): void {
    this.mount();
    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    this.unmount();
    this._memoizedValue = noValue;
  }

  protected abstract mount(): void;

  protected abstract unmount(): void;
}
