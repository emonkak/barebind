import type { Binding, Directive, UpdateContext } from '../directive.js';
import type { Part } from '../part.js';

export interface Primitive<T> extends Directive<T> {
  ensureValue(value: unknown, part: Part): asserts value is T;
}

export abstract class PrimitiveBinding<TValue, TPart extends Part>
  implements Binding<TValue>
{
  private _pendingValue: TValue;

  protected _memoizedValue: TValue | null = null;

  private readonly _part: TPart;

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

  shouldBind(value: TValue): boolean {
    return (
      this._memoizedValue === null ||
      !this.shouldMount(value, this._memoizedValue)
    );
  }

  bind(value: TValue, _context: UpdateContext): void {
    this._pendingValue = value;
  }

  connect(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}

  commit(): void {
    this.mount(this._pendingValue, this._memoizedValue, this._part);
    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    if (this._memoizedValue !== null) {
      this.unmount(this._memoizedValue, this._part);
    }
    this._memoizedValue = null;
  }

  protected abstract shouldMount(newValue: TValue, oldValue: TValue): boolean;

  protected abstract mount(
    value: TValue,
    oldValue: TValue | null,
    part: TPart,
  ): void;

  protected abstract unmount(value: TValue, part: TPart): void;
}
