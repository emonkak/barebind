import {
  type DirectiveContext,
  PART_TYPE_CHILD_NODE,
  type Part,
  type Primitive,
} from '../core.js';
import { ensurePartType } from '../dom.js';
import { PrimitiveBinding, toStringOrEmpty } from './primitive.js';

export abstract class CommentType {
  static resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): CommentBinding<T> {
    DEBUG: {
      ensurePartType(PART_TYPE_CHILD_NODE, this, value, part);
    }
    return new CommentBinding(value, part);
  }
}

export class CommentBinding<T> extends PrimitiveBinding<T, Part.ChildNodePart> {
  private _currentValue: T | null = null;

  get type(): Primitive<T> {
    return CommentType;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._currentValue);
  }

  override commit(): void {
    const value = this._pendingValue;
    this._part.sentinelNode.data = toStringOrEmpty(value);
    this._currentValue = this._pendingValue;
  }

  override rollback(): void {
    if (this._currentValue !== null) {
      this._part.sentinelNode.data = '';
      this._currentValue = null;
    }
  }
}
