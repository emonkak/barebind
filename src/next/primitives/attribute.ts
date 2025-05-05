import { type DirectiveProtocol, resolveBindingTag } from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type AttributePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const AttributePrimitive: Primitive<unknown> = {
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  [resolveBindingTag](
    value: unknown,
    part: Part,
    _context: DirectiveProtocol,
  ): AttributeBinding {
    if (part.type !== PartType.Attribute) {
      throw new Error(
        'Attribute primitive must be used in an attribute, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new AttributeBinding(value, part);
  },
};

export class AttributeBinding extends PrimitiveBinding<unknown, AttributePart> {
  get directive(): Primitive<unknown> {
    return AttributePrimitive;
  }

  mount(value: unknown, part: AttributePart): void {
    switch (typeof value) {
      case 'string':
        part.node.setAttribute(part.name, value);
        break;
      case 'boolean':
        part.node.toggleAttribute(part.name, value);
        break;
      default:
        if (value == null) {
          part.node.removeAttribute(part.name);
        } else {
          part.node.setAttribute(part.name, value.toString());
        }
    }
  }

  unmount(_value: unknown, part: AttributePart): void {
    part.node.removeAttribute(part.name);
  }

  update(newValue: unknown, _oldValue: unknown, part: AttributePart): void {
    this.mount(newValue, part);
  }
}
