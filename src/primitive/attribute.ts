import {
  type DirectiveContext,
  PART_TYPE_ATTRIBUTE,
  type Part,
  type Primitive,
} from '../core.js';
import { ensurePartType } from '../part.js';
import { PrimitiveBinding, toStringOrEmpty } from './primitive.js';

export abstract class AttributeType {
  static resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): AttributeBinding<T> {
    DEBUG: {
      ensurePartType(PART_TYPE_ATTRIBUTE, this, value, part);
    }
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

    if (typeof value === 'boolean') {
      node.toggleAttribute(name, value);
    } else if (value == null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, toStringOrEmpty(value));
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
