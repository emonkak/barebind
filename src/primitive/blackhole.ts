import type { DirectiveContext, Part, Primitive } from '../core.js';
import { PrimitiveBinding } from './primitive.js';

export abstract class BlackholeType {
  static resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): BlackholeBinding<T> {
    return new BlackholeBinding(value, part);
  }
}

export class BlackholeBinding<T> extends PrimitiveBinding<T, Part> {
  get type(): Primitive<T> {
    return BlackholeType;
  }

  shouldUpdate(_value: T): boolean {
    return false;
  }
}
