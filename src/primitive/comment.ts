import { ensurePartType } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export const CommentPrimitive: Primitive<any> = {
  name: 'CommentPrimitive',
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): CommentBinding<unknown> {
    ensurePartType<Part.ChildNodePart>(PartType.ChildNode, this, value, part);
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
