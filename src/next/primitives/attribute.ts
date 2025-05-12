import type { DirectiveContext } from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type AttributePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const AttributePrimitive: Primitive<unknown> = {
  get name(): string {
    return 'AttributePrimitive';
  },
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): AttributeBinding<unknown> {
    if (part.type !== PartType.Attribute) {
      throw new Error(
        'Attribute primitive must be used in an attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new AttributeBinding(value, part);
  },
};

export class AttributeBinding<T> extends PrimitiveBinding<T, AttributePart> {
  get directive(): Primitive<T> {
    return AttributePrimitive as Primitive<T>;
  }

  shouldUpdate(newValue: T, oldValue: unknown): boolean {
    return !Object.is(newValue, oldValue);
  }

  mount(value: T, part: AttributePart): void {
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

  unmount(_value: T, part: AttributePart): void {
    part.node.removeAttribute(part.name);
  }

  update(newValue: T, _oldValue: T, part: AttributePart): void {
    this.mount(newValue, part);
  }
}
