import {
  type CommitContext,
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
  type RefObject,
} from '../core.js';
import { debugPart, debugValue, markUsedValue } from '../debug.js';
import { DirectiveSpecifier } from '../directive.js';
import { PrimitiveBinding } from './primitive.js';

export type Ref =
  | RefCallback<Element>
  | RefObject<Element | null>
  | null
  | undefined;

export type RefCallback<T> = (value: T) => Cleanup | void;

export type Cleanup = () => void;

export const RefPrimitive: Primitive<Ref> = {
  name: 'RefPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is Ref {
    if (!isRef(value)) {
      throw new Error(
        `The value of RefPrimitive must be a function, object, null or undefined, but got ${debugValue(value)}.\n` +
          debugPart(part, markUsedValue(value)),
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
          debugPart(part, markUsedValue(new DirectiveSpecifier(this, ref))),
      );
    }
    return new RefBinding(ref, part);
  },
};

export class RefBinding extends PrimitiveBinding<Ref, Part.AttributePart> {
  private _memoizedValue: Ref = null;

  private _memoizedCleanup: Cleanup | void = undefined;

  get type(): Primitive<Ref> {
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
