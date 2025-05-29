import type { DirectiveContext } from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type Part, PartType, type TextPart } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const TextPrimitive: Primitive<any> = {
  name: 'TextPrimitive',
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): TextBinding<unknown> {
    if (part.type !== PartType.Text) {
      throw new Error(
        'TextPrimitive must be used in a node part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new TextBinding(value, part);
  },
};

class TextBinding<T> extends PrimitiveBinding<T, TextPart> {
  private _memoizedValue: T | null = null;

  get directive(): Primitive<T> {
    return TextPrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(): void {
    const value = this._pendingValue;
    const { node } = this._part;
    node.data = typeof value === 'string' ? value : (value?.toString() ?? '');
    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    if (this._memoizedValue !== null) {
      this._part.node.data = '';
      this._memoizedValue = null;
    }
  }
}
