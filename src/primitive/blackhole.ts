import type { DirectiveContext, Part, Primitive } from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export class BlackholePrimitive<T> implements Primitive<T> {
  static readonly instance: BlackholePrimitive<any> = new BlackholePrimitive();

  resolveBinding(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): BlackholeBinding<T> {
    return new BlackholeBinding(value, part);
  }
}

export class BlackholeBinding<T> extends PrimitiveBinding<T, Part> {
  get type(): Primitive<T> {
    return BlackholePrimitive.instance;
  }

  shouldUpdate(_value: T): boolean {
    return false;
  }

  commit(): void {}

  rollback(): void {}
}
