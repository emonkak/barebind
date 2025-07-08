import type {
  CommitContext,
  DirectiveContext,
  Primitive,
} from '../directive.js';
import type { Part } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const BlackholePrimitive: Primitive<any> = {
  displayName: 'BlackholePrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): BlackholeBinding<T> {
    return new BlackholeBinding(value, part);
  },
};

export class BlackholeBinding<T> extends PrimitiveBinding<T, Part> {
  get type(): Primitive<T> {
    return BlackholePrimitive;
  }

  shouldBind(_value: T): boolean {
    return false;
  }

  commit(_context: CommitContext): void {}

  rollback(_context: CommitContext): void {}
}
