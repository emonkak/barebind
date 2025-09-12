import type { DirectiveContext, Part, Primitive } from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export const BlackholePrimitive: Primitive<any> = {
  name: 'BlackholePrimitive',
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

  shouldUpdate(_value: T): boolean {
    return false;
  }

  commit(): void {}

  rollback(): void {}
}
