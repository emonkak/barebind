import {
  type CommitContext,
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../core.js';
import { debugPart } from '../debug/part.js';
import { markUsedValue } from '../debug/value.js';
import { DirectiveSpecifier } from '../directive.js';
import { PrimitiveBinding } from './primitive.js';

export const CommentPrimitive: Primitive<any> = {
  name: 'CommentPrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): CommentBinding<T> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'CommentPrimitive must be used in a child node, but it is used here:\n' +
          debugPart(part, markUsedValue(new DirectiveSpecifier(this, value))),
      );
    }
    return new CommentBinding(value, part);
  },
};

export class CommentBinding<T> extends PrimitiveBinding<T, Part.ChildNodePart> {
  private _memoizedValue: T | null = null;

  get type(): Primitive<T> {
    return CommentPrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(_context: CommitContext): void {
    const value = this._pendingValue;
    this._part.node.data = value?.toString() ?? '';
    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: CommitContext): void {
    if (this._memoizedValue !== null) {
      this._part.node.data = '';
      this._memoizedValue = null;
    }
  }
}
