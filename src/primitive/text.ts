import {
  type DirectiveContext,
  PART_TYPE_TEXT,
  type Part,
  type Primitive,
} from '../core.js';
import { ensurePartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const TextPrimitive: Primitive<any> = {
  name: 'TextPrimitive',
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): TextBinding<unknown> {
    ensurePartType<Part.TextPart>(PART_TYPE_TEXT, this, value, part);
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

  override commit(): void {
    const { node, precedingText, followingText } = this._part;
    const value = this._value;
    node.data = precedingText + (value?.toString() ?? '') + followingText;
    this._memoizedValue = this._value;
  }

  override rollback(): void {
    if (this._memoizedValue !== null) {
      this._part.node.data = '';
      this._memoizedValue = null;
    }
  }
}
