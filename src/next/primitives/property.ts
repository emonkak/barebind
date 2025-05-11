import type { DirectiveContext } from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type Part, PartType, type PropertyPart } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const PropertyPrimitive: Primitive<unknown> = {
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
        'Property primitive must be used in a property part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new PropertyBinding(value, part);
  },
};

export class PropertyBinding<T> extends PrimitiveBinding<T, PropertyPart> {
  get directive(): Primitive<T> {
    return PropertyPrimitive as Primitive<T>;
  }

  shouldUpdate(newValue: T, oldValue: T): boolean {
    return !Object.is(newValue, oldValue);
  }

  mount(value: T, part: PropertyPart): void {
    (part.node as any)[part.name] = value;
  }

  unmount(_value: T, _part: PropertyPart): void {}

  update(newValue: T, _oldValue: T, part: PropertyPart): void {
    this.mount(newValue, part);
  }
}
