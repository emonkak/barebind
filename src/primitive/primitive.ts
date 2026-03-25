import type { Binding, Primitive, Session } from '../core.js';

export abstract class PrimitiveBinding<TValue, TPart>
  implements Binding<TValue, TPart>
{
  protected _pendingValue: TValue;

  protected readonly _part: TPart;

  constructor(value: TValue, part: TPart) {
    this._pendingValue = value;
    this._part = part;
  }

  abstract get type(): Primitive<TValue, TPart>;

  get value(): TValue {
    return this._pendingValue;
  }

  set value(value: TValue) {
    this._pendingValue = value;
  }

  get part(): TPart {
    return this._part;
  }

  abstract shouldUpdate(value: TValue): boolean;

  attach(_session: Session): void {}

  detach(_session: Session): void {}

  commit(): void {}

  rollback(): void {}
}

export function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function';
}

export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export function toStringOrEmpty(value: unknown): string {
  return value?.toString?.() ?? '';
}
