import {
  type DirectiveContext,
  type Effect,
  PART_TYPE_ATTRIBUTE,
  type Part,
  type Primitive,
  type Session,
} from '../core.js';
import { DirectiveError } from '../error.js';
import { ensurePartType } from '../part.js';
import type { Cleanup, Ref, RefObject } from '../render-context.js';
import { PrimitiveBinding } from './primitive.js';

export abstract class RefType {
  static ensureValue(
    value: unknown,
    part: Part,
  ): asserts value is Ref<Element> {
    if (!isElementRef(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'RefType values must be function, object, null or undefined.',
      );
    }
  }

  static resolveBinding(
    value: Ref<Element>,
    part: Part,
    _context: DirectiveContext,
  ): RefBinding {
    DEBUG: {
      ensurePartType(PART_TYPE_ATTRIBUTE, this, value, part);
    }
    return new RefBinding(value, part);
  }
}

export class RefBinding extends PrimitiveBinding<
  Ref<Element>,
  Part.AttributePart
> {
  private _currentValue: Ref<Element>;

  private _currentCleanup: Cleanup | void = undefined;

  get type(): Primitive<Ref<Element>> {
    return RefType;
  }

  shouldUpdate(value: Ref<Element>): boolean {
    return value !== this._currentValue;
  }

  override attach(session: Session): void {
    session.frame.layoutEffects.pushBefore(new InvokeRef(this));
  }

  override detach(session: Session): void {
    session.frame.mutationEffects.pushAfter(new CleanupRef(this));
  }

  invokeRef(): void {
    const newRef = this._pendingValue;
    const oldRef = this._currentValue;

    if (newRef !== oldRef) {
      if (typeof oldRef === 'function') {
        this._currentCleanup?.();
        this._currentCleanup = undefined;
      } else if (oldRef != null) {
        oldRef.current = null;
      }

      if (typeof newRef === 'function') {
        this._currentCleanup = newRef(this.part.node);
      } else if (newRef != null) {
        newRef.current = this.part.node;
      }
    }

    this._currentValue = this.value;
  }

  cleanupRef(): void {
    const ref = this._currentValue;

    if (ref != null) {
      if (typeof ref === 'function') {
        this._currentCleanup?.();
        this._currentCleanup = undefined;
      } else {
        ref.current = null;
      }
    }

    this._currentValue = null;
  }
}

function isElementRef(value: unknown): value is Ref<Element> {
  return (
    value == null ||
    typeof value === 'function' ||
    (value as RefObject<unknown>).current !== undefined
  );
}

class CleanupRef implements Effect {
  private readonly _binding: RefBinding;

  constructor(binding: RefBinding) {
    this._binding = binding;
  }

  commit(): void {
    this._binding.cleanupRef();
  }
}

class InvokeRef implements Effect {
  private readonly _binding: RefBinding;

  constructor(binding: RefBinding) {
    this._binding = binding;
  }

  commit(): void {
    this._binding.invokeRef();
  }
}
