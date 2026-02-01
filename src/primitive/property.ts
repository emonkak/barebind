import { ensurePartType } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

const noValue = Symbol('noValue');

export const PropertyPrimitive: Primitive<any> = {
  name: 'PropertyPrimitive',
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): PropertyBinding<unknown> {
    ensurePartType<Part.PropertyPart>(PartType.Property, this, value, part);
    return new PropertyBinding(value, part);
  },
};

export class PropertyBinding<T> extends PrimitiveBinding<T, Part.PropertyPart> {
  private _memoizedValue: T | typeof noValue = noValue;

  get type(): Primitive<T> {
    return PropertyPrimitive;
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
    if (this._memoizedValue !== noValue) {
      const { node, name, defaultValue } = this._part;
      (node as any)[name] = defaultValue;
      this._memoizedValue = noValue;
    }
  }
}
