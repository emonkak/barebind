import type { DirectiveContext, Primitive } from '../core.js';
import type { Part } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const BlackholePrimitive: Primitive<never> = {
  name: 'BlackholePrimitive',
  resolveBinding(
    value: never,
    part: Part,
    _context: DirectiveContext,
  ): BlackholeBinding {
    return new BlackholeBinding(value, part);
  },
};

class BlackholeBinding extends PrimitiveBinding<never, Part> {
  get directive(): Primitive<never> {
    return BlackholePrimitive;
  }

  shouldBind(_value: never): boolean {
    return false;
  }

  commit(): void {}

  rollback(): void {}
}
