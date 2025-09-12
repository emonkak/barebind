import { DirectiveError } from '../directive.js';
import {
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
      throw new DirectiveError(
        TextPrimitive,
        value,
        part,
        'TextPrimitive must be used in a text part.',
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

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(): void {
    const { node, precedingText, followingText } = this.part;
    const value = this.value;
    node.data = precedingText + (value?.toString() ?? '') + followingText;
    this._memoizedValue = this.value;
  }

  rollback(): void {
    if (this._memoizedValue !== null) {
      this.part.node.nodeValue = null;
      this._memoizedValue = null;
    }
  }
}
