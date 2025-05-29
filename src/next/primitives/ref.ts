import type { DirectiveContext } from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { RefObject } from '../hook.js';
import { type AttributePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export type RefValue =
  | RefCallback<Element>
  | RefObject<Element | null>
  | null
  | undefined;

export type RefCallback<T> = (value: T) => VoidFunction | void;

export const RefPrimitive: Primitive<RefValue> = {
  name: 'RefPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is RefValue {
    if (
      !(
        typeof value === 'function' ||
        (typeof value === 'object' &&
          (value as RefObject<unknown>)?.current !== undefined)
      )
    ) {
      throw new Error(
        `The value of RefPrimitive must be Function, Object, null or undefined, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    value: RefValue,
    part: Part,
    _context: DirectiveContext,
  ): RefBinding {
    if (part.type !== PartType.Attribute || part.name !== ':ref') {
      throw new Error(
        'RefPrimitive must be used in a ":ref" attribute part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new RefBinding(value, part);
  },
};

class RefBinding extends PrimitiveBinding<RefValue, AttributePart> {
  private _memoizedValue: RefValue = null;

  private _memoizedCleanup: VoidFunction | void = void 0;

  get directive(): Primitive<RefValue> {
    return RefPrimitive;
  }

  shouldBind(ref: RefValue): boolean {
    return ref !== this._memoizedValue;
  }

  commit(): void {
    const newRef = this._pendingValue;
    const oldRef = this._memoizedValue;

    if (oldRef != null) {
      if (typeof oldRef === 'function') {
        this._memoizedCleanup?.();
        this._memoizedCleanup = undefined;
      } else {
        oldRef.current = null;
      }
    }

    if (newRef != null) {
      if (typeof newRef === 'function') {
        this._memoizedCleanup = newRef(this._part.node);
      } else {
        newRef.current = this._part.node;
      }
    }

    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    const ref = this._memoizedValue;

    if (ref != null) {
      if (typeof ref === 'function') {
        this._memoizedCleanup?.();
        this._memoizedCleanup = undefined;
      } else {
        ref.current = null;
      }
    }

    this._memoizedValue = null;
  }
}
