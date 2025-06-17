import type { DirectiveContext, Primitive } from '../directive.js';
import type { Part } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const BlackholePrimitive = {
  name: 'BlackholePrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): BlackholeBinding<T> {
    return new BlackholeBinding(value, part);
  },
} as const satisfies Primitive<unknown>;

export class BlackholeBinding<T> extends PrimitiveBinding<T, Part> {
  get directive(): Primitive<T> {
    return BlackholePrimitive as Primitive<T>;
  }

  shouldBind(_value: T): boolean {
    return false;
  }

  commit(): void {}

  rollback(): void {}
}
