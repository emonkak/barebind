import {
  type Cleanup,
  type CommitContext,
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
  type RefCallback,
  type RefObject,
} from '../core.js';
import { debugPart } from '../debug/part.js';
import { debugValue, markUsedValue } from '../debug/value.js';
import { DirectiveSpecifier } from '../directive.js';
import { PrimitiveBinding } from './primitive.js';

export type ElementRef = RefCallback<Element> | RefObject<Element | null>;

type Nullable<T> = T | null | undefined;

export const RefPrimitive: Primitive<Nullable<ElementRef>> = {
  name: 'RefPrimitive',
  ensureValue(
    value: unknown,
    part: Part,
  ): asserts value is Nullable<ElementRef> {
    if (value != null && !isElementRef(value)) {
      throw new Error(
        `The value of RefPrimitive must be a function, object, null or undefined, but got ${debugValue(value)}.\n` +
          debugPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    ref: Nullable<ElementRef>,
    part: Part,
    _context: DirectiveContext,
  ): RefBinding {
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

export class RefBinding extends PrimitiveBinding<
  Nullable<ElementRef>,
  Part.AttributePart
> {
  private _memoizedValue: Nullable<ElementRef> = null;

  private _memoizedCleanup: Cleanup | void = undefined;

  get type(): Primitive<Nullable<ElementRef>> {
    return RefPrimitive;
  }

  shouldBind(ref: Nullable<ElementRef>): boolean {
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

function isElementRef(value: {}): value is ElementRef {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' &&
      (value as RefObject<unknown>).current !== undefined)
  );
}
