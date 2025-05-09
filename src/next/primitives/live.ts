import { type DirectiveProtocol, resolveBindingTag } from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type LivePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const LivePrimitive: Primitive<unknown> = {
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  [resolveBindingTag](
    value: unknown,
    part: Part,
    _context: DirectiveProtocol,
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

  mount(value: T, part: LivePart): void {
    const liveValue = (part.node as any)[part.name];
    if (!Object.is(liveValue, value)) {
      (part.node as any)[part.name] = value;
    }
  }

  unmount(_value: T, _part: LivePart): void {}

  update(newValue: T, _oldValue: T, part: LivePart): void {
    this.mount(newValue, part);
  }
}
