import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type {
  CommitContext,
  DirectiveContext,
  Primitive,
} from '../directive.js';
import type { RefObject } from '../hook.js';
import { type AttributePart, type Part, PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export type Ref =
  | RefCallback<Element>
  | RefObject<Element | null>
  | null
  | undefined;

export type RefCallback<T> = (value: T) => (() => void) | void;

export const RefPrimitive: Primitive<Ref> = {
  displayName: 'RefPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is Ref {
    if (!isRef(value)) {
      throw new Error(
        `The value of RefPrimitive must be function, object, null or undefined, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(ref: Ref, part: Part, _context: DirectiveContext): RefBinding {
    if (
      part.type !== PartType.Attribute ||
      part.name.toLowerCase() !== ':ref'
    ) {
      throw new Error(
        'RefPrimitive must be used in ":ref" attribute part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(ref)),
      );
    }
    return new RefBinding(ref, part);
  },
};

export class RefBinding extends PrimitiveBinding<Ref, AttributePart> {
  private _memoizedValue: Ref = null;

  private _memoizedCleanup: (() => void) | void = void 0;

  get directive(): Primitive<Ref> {
    return RefPrimitive;
  }

  shouldBind(ref: Ref): boolean {
    return ref !== this._memoizedValue;
  }

  commit(_context: CommitContext): void {
    const newRef = this._pendingValue;
    const oldRef = this._memoizedValue;

    if (newRef !== oldRef) {
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
    }

    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: CommitContext): void {
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

function isRef(value: unknown): value is Ref {
  return (
    value == null ||
    typeof value === 'function' ||
    (typeof value === 'object' &&
      (value as RefObject<unknown>).current !== undefined)
  );
}
