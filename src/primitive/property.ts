import {
  type DirectiveContext,
  PART_TYPE_PROPERTY,
  type Part,
  type Primitive,
} from '../core.js';
import { ensurePartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

const NoValue = Symbol();

export abstract class PropertyType {
  static resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): PropertyBinding<T> {
    ensurePartType(PART_TYPE_PROPERTY, this, value, part);
    return new PropertyBinding(value, part);
  }
}

export class PropertyBinding<T> extends PrimitiveBinding<T, Part.PropertyPart> {
  private _memoizedValue: T | typeof NoValue = NoValue;

  get type(): Primitive<T> {
    return PropertyType;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  override commit(): void {
    const { node, name } = this._part;
    (node as any)[name] = this._value;
    this._memoizedValue = this._value;
  }

  override rollback(): void {
    if (this._memoizedValue !== NoValue) {
      const { node, name, defaultValue } = this._part;
      (node as any)[name] = defaultValue;
      this._memoizedValue = NoValue;
    }
  }
}
