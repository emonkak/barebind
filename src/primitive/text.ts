import {
  type DirectiveContext,
  PART_TYPE_TEXT,
  type Part,
  type Primitive,
} from '../core.js';
import { ensurePartType } from '../part.js';
import { PrimitiveBinding, toStringOrEmpty } from './primitive.js';

export abstract class TextType {
  static resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): TextBinding<T> {
    DEBUG: {
      ensurePartType(PART_TYPE_TEXT, this, value, part);
    }
    return new TextBinding(value, part);
  }
}

export class TextBinding<T> extends PrimitiveBinding<T, Part.TextPart> {
  private _memoizedValue: T | null = null;

  get type(): Primitive<T> {
    return TextType;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  override commit(): void {
    const { node, precedingText, followingText } = this._part;
    const value = this._value;
    node.data = precedingText + toStringOrEmpty(value) + followingText;
    this._memoizedValue = this._value;
  }

  override rollback(): void {
    if (this._memoizedValue !== null) {
      this._part.node.data = '';
      this._memoizedValue = null;
    }
  }
}
