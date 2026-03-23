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
  private _currentValue: T | null = null;

  get type(): Primitive<T> {
    return TextType;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._currentValue);
  }

  override commit(): void {
    const { node, precedingText, followingText } = this._part;
    const value = this._pendingValue;
    node.data = precedingText + toStringOrEmpty(value) + followingText;
    this._currentValue = this._pendingValue;
  }

  override rollback(): void {
    if (this._currentValue !== null) {
      this._part.node.data = '';
      this._currentValue = null;
    }
  }
}
