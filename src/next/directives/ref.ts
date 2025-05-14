import type { DirectiveContext } from '../coreTypes.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { RefObject } from '../hook.js';
import { type AttributePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export type RefValue = RefCallback<Element> | RefObject<Element | null>;

export type RefCallback<T> = (value: T) => VoidFunction | void;

export const RefPrimitive: Primitive<RefValue> = {
  get name(): string {
    return 'RefPrimitive';
  },
  ensureValue(value: unknown, part: Part): asserts value is RefValue {
    if (
      !(
        typeof value === 'function' ||
        (typeof value === 'object' &&
          (value as RefObject<unknown>)?.current !== undefined)
      )
    ) {
      throw new Error(
        `The value of ref primitive must be Function or Object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    value: RefValue,
    part: Part,
    _context: DirectiveContext,
  ): RefBinding {
    if (part.type !== PartType.Attribute || part.name !== 'ref') {
      throw new Error(
        'Ref primitive must be used in a ":ref" attribute part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new RefBinding(value, part);
  },
};

class RefBinding extends PrimitiveBinding<RefValue, AttributePart> {
  private _memoizedCleanup: VoidFunction | void = void 0;

  get directive(): Primitive<RefValue> {
    return RefPrimitive;
  }

  shouldUpdate(_newValue: RefValue, _oldValue: RefValue): boolean {
    return true;
  }

  mount(): void {
    const oldRef = this._memoizedValue;
    const newRef = this._pendingValue;
    if (oldRef !== null) {
      if (typeof oldRef === 'object') {
        oldRef.current = null;
      } else {
        this._memoizedCleanup?.();
        this._memoizedCleanup = void 0;
      }
    }
    if (typeof newRef === 'object') {
      newRef.current = this._part.node;
    } else {
      this._memoizedCleanup = newRef(this._part.node);
    }
  }

  unmount(): void {
    const ref = this._memoizedValue;
    if (ref != null) {
      if (typeof ref === 'object') {
        ref.current = null;
      } else {
        this._memoizedCleanup?.();
        this._memoizedCleanup = void 0;
      }
    }
  }
}
