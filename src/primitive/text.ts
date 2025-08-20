import { formatPart } from '../debug/part.js';
import { markUsedValue } from '../debug/value.js';
import { DirectiveSpecifier } from '../directive.js';
import {
  type CommitContext,
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export const TextPrimitive: Primitive<any> = {
  name: 'TextPrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): TextBinding<T> {
    if (part.type !== PartType.Text) {
      throw new Error(
        'TextPrimitive must be used in a text part, but it is used here:\n' +
          formatPart(part, markUsedValue(new DirectiveSpecifier(this, value))),
      );
    }
    return new TextBinding(value, part);
  },
};

export class TextBinding<T> extends PrimitiveBinding<T, Part.TextPart> {
  private _memoizedValue: T | null = null;

  get type(): Primitive<T> {
    return TextPrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(_context: CommitContext): void {
    const { node, precedingText, followingText } = this._part;
    const value = this._pendingValue;
    node.data = precedingText + (value?.toString() ?? '') + followingText;
    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: CommitContext): void {
    if (this._memoizedValue !== null) {
      this._part.node.nodeValue = null;
      this._memoizedValue = null;
    }
  }
}
