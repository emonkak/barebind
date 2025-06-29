import { inspectPart, markUsedValue } from '../debug.js';
import type { DirectiveContext, Primitive } from '../directive.js';
import { type Part, PartType, type TextPart } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const TextPrimitive = {
  name: 'TextPrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): TextBinding<T> {
    if (part.type !== PartType.Text) {
      throw new Error(
        'TextPrimitive must be used in a text part, but it is used here:\n' +
          inspectPart(part, markUsedValue(value)),
      );
    }
    return new TextBinding(value, part);
  },
} as const satisfies Primitive<unknown>;

export class TextBinding<T> extends PrimitiveBinding<T, TextPart> {
  private _memoizedValue: T | null = null;

  get directive(): Primitive<T> {
    return TextPrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(): void {
    const { node, precedingText, followingText } = this._part;
    const value = this._pendingValue;
    node.data = precedingText + (value?.toString() ?? '') + followingText;
    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    if (this._memoizedValue !== null) {
      this._part.node.nodeValue = null;
      this._memoizedValue = null;
    }
  }
}
