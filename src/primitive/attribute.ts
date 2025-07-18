import {
  type CommitContext,
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { DirectiveSpecifier } from '../directive.js';
import { PrimitiveBinding } from './primitive.js';

export const AttributePrimitive: Primitive<any> = {
  name: 'AttributePrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): AttributeBinding<T> {
    if (part.type !== PartType.Attribute) {
      throw new Error(
        'AttributePrimitive must be used in an attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(new DirectiveSpecifier(this, value))),
      );
    }
    return new AttributeBinding(value, part);
  },
};

export class AttributeBinding<T> extends PrimitiveBinding<
  T,
  Part.AttributePart
> {
  private _memoizedValue: T | null = null;

  get type(): Primitive<T> {
    return AttributePrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(_context: CommitContext): void {
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

  rollback(_context: CommitContext): void {
    if (this._memoizedValue !== null) {
      const { node, name } = this._part;
      node.removeAttribute(name);
      this._memoizedValue = null;
    }
  }
}
