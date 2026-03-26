import type { DirectiveContext, Primitive } from '../../core.js';
import { PrimitiveBinding, toStringOrEmpty } from '../../primitive.js';
import { ensurePartType } from '../error.js';
import { type DOMPart, PART_TYPE_ATTRIBUTE } from '../part.js';
import type { DOMRenderer } from '../template.js';

export abstract class DOMAttribute {
  static resolveBinding<T>(
    value: T,
    part: DOMPart,
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMAttributeBinding<T> {
    DEBUG: {
      ensurePartType(PART_TYPE_ATTRIBUTE, DOMAttribute, value, part);
    }
    return new DOMAttributeBinding(value, part);
  }
}

export class DOMAttributeBinding<T> extends PrimitiveBinding<
  T,
  DOMPart.Attribute,
  DOMRenderer
> {
  private _currentValue: T | null = null;

  get type(): Primitive<T, DOMPart.Attribute> {
    return DOMAttribute;
  }

  shouldUpdate(newValue: T): boolean {
    return !Object.is(newValue, this._currentValue);
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
