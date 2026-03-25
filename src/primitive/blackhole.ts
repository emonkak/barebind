import type { DirectiveContext, Primitive } from '../core.js';
import { PrimitiveBinding } from './primitive.js';

export abstract class BlackholeType {
  static resolveBinding<TValue, TPart>(
    value: TValue,
    part: TPart,
    _context: DirectiveContext,
  ): BlackholeBinding<TValue, TPart> {
    return new BlackholeBinding(value, part);
  }
}

export class BlackholeBinding<TValue, TPart> extends PrimitiveBinding<
  TValue,
  TPart
> {
  get type(): Primitive<TValue, TPart> {
    return BlackholeType;
  }

  shouldUpdate(_value: TValue): boolean {
    return false;
  }
}
