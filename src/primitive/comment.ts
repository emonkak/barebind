import { DirectiveError } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export class CommentPrimitive<T> implements Primitive<T> {
  static readonly instance: CommentPrimitive<any> = new CommentPrimitive();

  resolveBinding(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): CommentBinding<T> {
    if (part.type !== PartType.ChildNode) {
      throw new DirectiveError(
        this,
        value,
        part,
        'CommentPrimitive must be used in a child node.',
      );
    }
    return new CommentBinding(value, part);
  }
}

export class CommentBinding<T> extends PrimitiveBinding<T, Part.ChildNodePart> {
  private _memoizedValue: T | null = null;

  get type(): Primitive<T> {
    return CommentPrimitive.instance;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(): void {
    const value = this._value;
    this._part.node.data = value?.toString() ?? '';
    this._memoizedValue = this._value;
  }

  rollback(): void {
    if (this._memoizedValue !== null) {
      this._part.node.data = '';
      this._memoizedValue = null;
    }
  }
}
