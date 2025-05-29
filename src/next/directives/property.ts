import { inspectPart, markUsedValue } from '../debug.js';
import type { DirectiveContext } from '../directive.js';
import { type Part, PartType, type PropertyPart } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const PropertyPrimitive: Primitive<unknown> = {
  get name(): string {
    return 'PropertyPrimitive';
  },
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

class PropertyBinding<T> extends PrimitiveBinding<T, PropertyPart> {
  get directive(): Primitive<T> {
    return PropertyPrimitive as Primitive<T>;
  }

  shouldMount(newValue: T, oldValue: T): boolean {
    return !Object.is(newValue, oldValue);
  }

  mount(newValue: T, _oldValue: T | null, part: PropertyPart): void {
    const { node, name } = part;
    (node as any)[name] = newValue;
  }

  unmount(_value: T): void {}
}
