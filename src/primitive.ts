import type { Binding, DirectiveContext, Primitive, Session } from './core.js';

export abstract class Blackhole {
  static resolveBinding<TValue, TPart, TRenderer>(
    value: TValue,
    part: TPart,
    _context: DirectiveContext<TPart, TRenderer>,
  ): BlackholeBinding<TValue, TPart, TRenderer> {
    return new BlackholeBinding(value, part);
  }
}

export abstract class PrimitiveBinding<TValue, TPart, TRenderer>
  implements Binding<TValue, TPart>
{
  protected _pendingValue: TValue;

  protected readonly _part: TPart;

  constructor(value: TValue, part: TPart) {
    this._pendingValue = value;
    this._part = part;
  }

  abstract get type(): Primitive<TValue, TPart, TRenderer>;

  get value(): TValue {
    return this._pendingValue;
  }

  set value(newValue: TValue) {
    this._pendingValue = newValue;
  }

  get part(): TPart {
    return this._part;
  }

  abstract shouldUpdate(newValue: TValue): boolean;

  attach(_session: Session<TPart, TRenderer>): void {}

  detach(_session: Session<TPart, TRenderer>): void {}

  commit(): void {}

  rollback(): void {}
}

export class BlackholeBinding<
  TValue,
  TPart,
  TRenderer,
> extends PrimitiveBinding<TValue, TPart, TRenderer> {
  get type(): Primitive<TValue, TPart> {
    return Blackhole;
  }

  shouldUpdate(_value: TValue): boolean {
    return false;
  }
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
