import { type DirectiveProtocol, resolveBindingTag } from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type Part, PartType, type PropertyPart } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const PropertyPrimitive: Primitive<unknown> = {
  ensureValue(
    _value: unknown,
    _part: PropertyPart,
  ): asserts _value is unknown {},
  [resolveBindingTag](
    value: unknown,
    part: Part,
    _context: DirectiveProtocol,
  ): PrimitiveBinding<unknown, PropertyPart> {
    if (part.type !== PartType.Property) {
      throw new Error(
        'Property primitive must be used in a node, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new PropertyBinding(value, part);
  },
};

export class PropertyBinding extends PrimitiveBinding<unknown, PropertyPart> {
  get directive(): typeof PropertyPrimitive {
    return PropertyPrimitive;
  }

  mount(value: unknown, part: PropertyPart): void {
    (part.node as any)[part.name] = value;
  }

  unmount(_value: unknown, _part: PropertyPart): void {}

  update(newValue: unknown, _oldValue: unknown, part: PropertyPart): void {
    this.mount(newValue, part);
  }
}
