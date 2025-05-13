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

class AttributeBinding<T> extends PrimitiveBinding<T, AttributePart> {
  get directive(): Primitive<T> {
    return AttributePrimitive as Primitive<T>;
  }

  shouldUpdate(newValue: T, oldValue: unknown): boolean {
    return !Object.is(newValue, oldValue);
  }

  mount(): void {
    const value = this._pendingValue;
    const { node, name } = this._part;
    switch (typeof value) {
      case 'string':
        node.setAttribute(name, value);
        break;
      case 'boolean':
        node.toggleAttribute(name, value);
        break;
      default:
        if (value == null) {
          node.removeAttribute(name);
        } else {
          node.setAttribute(name, value.toString());
        }
    }
  }

  unmount(): void {
    const { node, name } = this._part;
    node.removeAttribute(name);
  }
}
