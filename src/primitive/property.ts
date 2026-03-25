import type { DirectiveContext, Primitive } from '../core.js';
import {
  DOM_PART_TYPE_PROPERTY,
  type DOMPart,
  ensurePartType,
} from '../dom.js';
import { PrimitiveBinding } from './primitive.js';

const NoValue = Symbol();

export abstract class PropertyType {
  static resolveBinding<T>(
    value: T,
    part: DOMPart,
    _context: DirectiveContext,
  ): PropertyBinding<T> {
    DEBUG: {
      ensurePartType(DOM_PART_TYPE_PROPERTY, this, value, part);
    }
    return new PropertyBinding(value, part);
  }
}

export class PropertyBinding<T> extends PrimitiveBinding<
  T,
  DOMPart.PropertyPart
> {
  private _currentValue: T | typeof NoValue = NoValue;

  get type(): Primitive<T, DOMPart.PropertyPart> {
    return PropertyType;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._currentValue);
  }

  override commit(): void {
    const { node, name } = this._part;
    (node as any)[name] = this._pendingValue;
    this._currentValue = this._pendingValue;
  }

  override rollback(): void {
    if (this._currentValue !== NoValue) {
      const { node, name, defaultValue } = this._part;
      (node as any)[name] = defaultValue;
      this._currentValue = NoValue;
    }
  }
}
