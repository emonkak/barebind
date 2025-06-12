import type { DirectiveContext, Primitive } from '../core.js';
import type { Part } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const BlackholePrimitive: Primitive<any> = {
  name: 'BlackholePrimitive',
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): BlackholeBinding<unknown> {
    return new BlackholeBinding(value, part);
  },
};

class BlackholeBinding<T> extends PrimitiveBinding<T, Part> {
  get directive(): Primitive<T> {
    return BlackholePrimitive;
  }

  shouldBind(_value: T): boolean {
    return false;
  }

  commit(): void {}

  rollback(): void {}
}
