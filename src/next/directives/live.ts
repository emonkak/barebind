import { inspectPart, markUsedValue } from '../debug.js';
import type { DirectiveContext } from '../directive.js';
import { type LivePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const LivePrimitive: Primitive<unknown> = {
  get name(): string {
    return 'LivePrimitive';
  },
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): LiveBinding<unknown> {
    if (part.type !== PartType.Live) {
      throw new Error(
        'Live primitive must be used in a live part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new LiveBinding(value, part);
  },
};

export class LiveBinding<T> extends PrimitiveBinding<T, LivePart> {
  get directive(): Primitive<T> {
    return LivePrimitive as Primitive<T>;
  }

  shouldUpdate(): boolean {
    return true;
  }

  mount(): void {
    const { node, name } = this._part;
    const currentValue = (node as any)[name];
    if (!Object.is(currentValue, this._pendingValue)) {
      (node as any)[name] = this._pendingValue;
    }
  }

  unmount(): void {}
}
