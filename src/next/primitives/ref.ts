import { type DirectiveProtocol, resolveBindingTag } from '../coreTypes.js';
import { inspectPart, markUsedValue, nameOf } from '../debug.js';
import type { RefObject } from '../hook.js';
import { type AttributePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export type RefValue = RefCallback<Element> | RefObject<Element | null>;

export type RefCallback<T> = (value: T) => VoidFunction | void;

export const RefPrimitive: Primitive<RefValue> = {
  ensureValue(value: unknown, part: Part): asserts value is RefValue {
    if (
      !(
        typeof value === 'function' ||
        (typeof value === 'object' &&
          (value as RefObject<unknown>)?.current !== undefined)
      )
    ) {
      throw new Error(
        `The value of ref primitive must be Function or Object, but got "${nameOf(value)}".\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  [resolveBindingTag](
    value: RefValue,
    part: Part,
    _context: DirectiveProtocol,
  ): RefBinding {
    if (part.type !== PartType.Attribute || part.name !== 'ref') {
      throw new Error(
        'Ref primitive must be used in a ":ref" attribute, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new RefBinding(value, part);
  },
};

export class RefBinding extends PrimitiveBinding<RefValue, AttributePart> {
  private _memoizedCleanup: VoidFunction | void = void 0;

  get directive(): typeof RefPrimitive {
    return RefPrimitive;
  }

  mount(value: RefValue, part: AttributePart): void {
    if (typeof value === 'function') {
      this._memoizedCleanup = value(part.node);
    } else {
      value.current = part.node;
    }
  }

  unmount(value: RefValue, _part: AttributePart): void {
    this._memoizedCleanup?.();
    if (typeof value === 'object') {
      value.current = null;
    }
  }

  update(newValue: RefValue, oldValue: RefValue, part: AttributePart): void {
    this.unmount(oldValue, part);
    this.mount(newValue, part);
  }
}
