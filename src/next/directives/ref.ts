import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { DirectiveContext } from '../directive.js';
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

export class RefBinding extends PrimitiveBinding<RefValue, AttributePart> {
  private _memoizedCleanup: VoidFunction | void = void 0;

  get directive(): Primitive<RefValue> {
    return RefPrimitive;
  }

  shouldMount(_newRef: RefValue, _oldRef: RefValue): boolean {
    return true;
  }

  mount(newRef: RefValue, oldRef: RefValue | null, part: AttributePart): void {
    if (oldRef !== null) {
      if (typeof oldRef === 'function') {
        this._memoizedCleanup?.();
        this._memoizedCleanup = void 0;
      } else {
        oldRef.current = null;
      }
    }
    if (typeof newRef === 'function') {
      this._memoizedCleanup = newRef(part.node);
    } else {
      newRef.current = part.node;
    }
  }

  unmount(ref: RefValue, _part: AttributePart): void {
    if (typeof ref === 'function') {
      this._memoizedCleanup?.();
      this._memoizedCleanup = void 0;
    } else {
      ref.current = null;
    }
  }
}
