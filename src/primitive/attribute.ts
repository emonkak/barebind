import { type DirectiveContext, Primitive } from '../core.js';
import {
  DOM_PART_TYPE_ATTRIBUTE,
  type DOMPart,
  ensurePartType,
} from '../dom.js';
import { PrimitiveBinding, toStringOrEmpty } from './primitive.js';

export abstract class AttributeType {
  static readonly kind = Primitive;
  static resolveBinding<T>(
    value: T,
    part: DOMPart,
    _context: DirectiveContext,
  ): AttributeBinding<T> {
    DEBUG: {
      ensurePartType(DOM_PART_TYPE_ATTRIBUTE, this, value, part);
    }
    return new AttributeBinding(value, part);
  }
}

export class AttributeBinding<T> extends PrimitiveBinding<
  T,
  DOMPart.AttributePart
> {
  private _currentValue: T | null = null;

  get type(): Primitive<T, DOMPart.AttributePart> {
    return AttributeType;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._currentValue);
  }

  override commit(): void {
    const { node, name } = this._part;
    const value = this._pendingValue;

    if (typeof value === 'boolean') {
      node.toggleAttribute(name, value);
    } else if (value == null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, toStringOrEmpty(value));
    }

    this._currentValue = this._pendingValue;
  }

  override rollback(): void {
    if (this._currentValue !== null) {
      const { node, name } = this._part;
      node.removeAttribute(name);
      this._currentValue = null;
    }
  }
}
