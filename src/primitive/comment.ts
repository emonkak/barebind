import {
  type DirectiveContext,
  PART_TYPE_CHILD_NODE,
  type Part,
  type Primitive,
} from '../core.js';
import { ensurePartType } from '../directive.js';
import { PrimitiveBinding } from './primitive.js';

export const CommentPrimitive: Primitive<any> = {
  name: 'CommentPrimitive',
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): CommentBinding<unknown> {
    ensurePartType<Part.ChildNodePart>(PART_TYPE_CHILD_NODE, this, value, part);
    return new CommentBinding(value, part);
  },
};

export class CommentBinding<T> extends PrimitiveBinding<T, Part.ChildNodePart> {
  private _memoizedValue: T | null = null;

  get type(): Primitive<T> {
    return CommentPrimitive;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  override commit(): void {
    const value = this._value;
    this._part.node.data = value?.toString() ?? '';
    this._memoizedValue = this._value;
  }

  override rollback(): void {
    if (this._memoizedValue !== null) {
      this._part.node.data = '';
      this._memoizedValue = null;
    }
  }
}
