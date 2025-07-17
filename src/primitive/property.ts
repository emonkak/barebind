import type { CommitContext, DirectiveContext, Primitive } from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { DirectiveSpecifier } from '../directive.js';
import { type Part, PartType, type PropertyPart } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

const noValue = Symbol('noValue');

export const PropertyPrimitive: Primitive<any> = {
  name: 'PropertyPrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): PrimitiveBinding<T, PropertyPart> {
    if (part.type !== PartType.Property) {
      throw new Error(
        'PropertyPrimitive must be used in a property part, but it is used here:\n' +
          inspectPart(part, markUsedValue(new DirectiveSpecifier(this, value))),
      );
    }
    return new PropertyBinding(value, part);
  },
};

export class PropertyBinding<T> extends PrimitiveBinding<T, PropertyPart> {
  private _memoizedValue: T | typeof noValue = noValue;

  get type(): Primitive<T> {
    return PropertyPrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(_context: CommitContext): void {
    const { node, name } = this._part;
    (node as any)[name] = this._pendingValue;
    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: CommitContext): void {
    if (this._memoizedValue !== noValue) {
      const { node, name, defaultValue } = this._part;
      (node as any)[name] = defaultValue;
      this._memoizedValue = noValue;
    }
  }
}
