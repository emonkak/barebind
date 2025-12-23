import { DirectiveError } from '../directive.js';
import {
  type Cleanup,
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
  type RefCallback,
  type RefObject,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export type ElementRef = RefCallback<Element> | RefObject<Element | null>;

export class RefPrimitive implements Primitive<ElementRef> {
  static readonly instance: RefPrimitive = new RefPrimitive();

  ensureValue(value: unknown, part: Part): asserts value is ElementRef {
    if (!isElementRef(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'The value of RefPrimitive must be a function, object, null or undefined.',
      );
    }
  }

  resolveBinding(
    ref: ElementRef,
    part: Part,
    _context: DirectiveContext,
  ): RefBinding {
    if (
      part.type !== PartType.Attribute ||
      part.name.toLowerCase() !== ':ref'
    ) {
      throw new DirectiveError(
        this,
        ref,
        part,
        'RefPrimitive must be used in ":ref" attribute part.',
      );
    }
    return new RefBinding(ref, part);
  }
}

export class RefBinding extends PrimitiveBinding<
  ElementRef,
  Part.AttributePart
> {
  private _memoizedValue: ElementRef | null = null;

  private _memoizedCleanup: Cleanup | void = undefined;

  get type(): Primitive<ElementRef> {
    return RefPrimitive.instance;
  }

  shouldUpdate(ref: ElementRef): boolean {
    return ref !== this._memoizedValue;
  }

  commit(): void {
    const newRef = this.value;
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

      if (typeof newRef === 'function') {
        this._memoizedCleanup = newRef(this.part.node);
      } else {
        newRef.current = this.part.node;
      }
    }

    this._memoizedValue = this.value;
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

function isElementRef(value: unknown): value is ElementRef {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' &&
      value !== null &&
      (value as RefObject<unknown>).current !== undefined)
  );
}
