import type { DirectiveContext, Effect, Primitive, Session } from '../core.js';
import {
  DOM_PART_TYPE_ATTRIBUTE,
  type DOMPart,
  ensurePartType,
} from '../dom.js';
import { DirectiveError } from '../error.js';
import type { Cleanup, Ref, RefObject } from '../render-context.js';
import { PrimitiveBinding } from './primitive.js';

export abstract class RefType {
  static ensureValue(
    value: unknown,
    part: DOMPart,
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
    part: DOMPart,
    _context: DirectiveContext,
  ): RefBinding {
    DEBUG: {
      ensurePartType(DOM_PART_TYPE_ATTRIBUTE, this, value, part);
    }
    return new RefBinding(value, part);
  }
}

export class RefBinding extends PrimitiveBinding<
  Ref<Element>,
  DOMPart.AttributePart
> {
  private _currentValue: Ref<Element>;

  private _currentCleanup: Cleanup | void = undefined;

  get type(): Primitive<Ref<Element>, DOMPart.AttributePart> {
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
