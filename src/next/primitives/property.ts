import type { DirectiveContext, Primitive } from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type Part, PartType, type PropertyPart } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

const noValue = Symbol('noValue');

export const PropertyPrimitive: Primitive<any> = {
  name: 'PropertyPrimitive',
  ensureValue(
    _value: unknown,
    _part: PropertyPart,
  ): asserts _value is unknown {},
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): PrimitiveBinding<unknown, PropertyPart> {
    if (part.type !== PartType.Property) {
      throw new Error(
        'PropertyPrimitive must be used in a property part, but it is used here:\n' +
          inspectPart(part, markUsedValue(value)),
      );
    }
    return new PropertyBinding(value, part);
  },
};

class PropertyBinding<T> extends PrimitiveBinding<T, PropertyPart> {
  private _memoizedValue: T | typeof noValue = noValue;

  get directive(): Primitive<T> {
    return PropertyPrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(): void {
    const { node, name } = this._part;
    (node as any)[name] = this._pendingValue;
    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    this._memoizedValue = noValue;
  }
}
