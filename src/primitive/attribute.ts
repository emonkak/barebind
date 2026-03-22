import {
  type DirectiveContext,
  PART_TYPE_ATTRIBUTE,
  type Part,
  type Primitive,
} from '../core.js';
import { ensurePartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export abstract class AttributeType {
  static resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): AttributeBinding<T> {
    ensurePartType(PART_TYPE_ATTRIBUTE, this, value, part);
    return new AttributeBinding(value, part);
  }
}

export class AttributeBinding<T> extends PrimitiveBinding<
  T,
  Part.AttributePart
> {
  private _memoizedValue: T | null = null;

  get type(): Primitive<T> {
    return AttributeType;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  override commit(): void {
    const { node, name } = this._part;
    const value = this._value;

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

    this._memoizedValue = this._value;
  }

  override rollback(): void {
    if (this._memoizedValue !== null) {
      const { node, name } = this._part;
      node.removeAttribute(name);
      this._memoizedValue = null;
    }
  }
}
