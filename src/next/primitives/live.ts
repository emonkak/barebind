import type { DirectiveContext, Primitive } from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type LivePart, type Part, PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const LivePrimitive: Primitive<any> = {
  name: 'LivePrimitive',
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): LiveBinding<unknown> {
    if (part.type !== PartType.Live) {
      throw new Error(
        'LivePrimitive must be used in a live part, but it is used here:\n' +
          inspectPart(part, markUsedValue(value)),
      );
    }
    return new LiveBinding(value, part);
  },
};

class LiveBinding<T> extends PrimitiveBinding<T, LivePart> {
  get directive(): Primitive<T> {
    return LivePrimitive;
  }

  shouldBind(_value: T): boolean {
    return true;
  }

  commit(): void {
    const value = this._pendingValue;
    const { node, name } = this._part;
    const currentValue = (node as any)[name];

    if (!Object.is(currentValue, value)) {
      (node as any)[name] = value;
    }
  }

  rollback(): void {}
}
