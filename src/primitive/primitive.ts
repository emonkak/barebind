import type { Binding, Part, Primitive, Session } from '../core.js';

export abstract class PrimitiveBinding<TValue, TPart extends Part>
  implements Binding<TValue>
{
  protected _value: TValue;

  protected readonly _part: TPart;

  constructor(value: TValue, part: TPart) {
    this._value = value;
    this._part = part;
  }

  abstract get type(): Primitive<TValue>;

  get value(): TValue {
    return this._value;
  }

  set value(value: TValue) {
    this._value = value;
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

export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export function toStringOrEmpty(value: unknown): string {
  return value?.toString?.() ?? '';
}
