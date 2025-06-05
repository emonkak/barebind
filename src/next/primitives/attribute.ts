import type { DirectiveContext, Primitive } from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type AttributePart, type Part, PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const AttributePrimitive: Primitive<any> = {
  name: 'AttributePrimitive',
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): AttributeBinding<unknown> {
    if (part.type !== PartType.Attribute) {
      throw new Error(
        'AttributePrimitive must be used in an attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new AttributeBinding(value, part);
  },
};

class AttributeBinding<T> extends PrimitiveBinding<T, AttributePart> {
  private _memoizedValue: T | null = null;

  get directive(): Primitive<T> {
    return AttributePrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(): void {
    const { node, name } = this._part;
    const value = this._pendingValue;

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

    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    if (this._memoizedValue !== null) {
      const { node, name } = this._part;
      node.removeAttribute(name);
    }

    this._memoizedValue = null;
  }
}
