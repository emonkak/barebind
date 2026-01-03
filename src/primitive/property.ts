import { DirectiveError } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

const noValue = Symbol('noValue');

export const PropertyPrimitive: Primitive<any> = {
  displayName: 'PropertyPrimitive',
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): PropertyBinding<unknown> {
    if (part.type !== PartType.Property) {
      throw new DirectiveError(
        this,
        value,
        part,
        'PropertyPrimitive must be used in a property part.',
      );
    }
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

  commit(): void {
    const { node, name } = this._part;
    (node as any)[name] = this._value;
    this._memoizedValue = this._value;
  }

  rollback(): void {
    if (this._memoizedValue !== noValue) {
      const { node, name, defaultValue } = this._part;
      (node as any)[name] = defaultValue;
      this._memoizedValue = noValue;
    }
  }
}
