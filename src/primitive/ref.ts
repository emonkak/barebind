import { DirectiveError, ensurePartType } from '../directive.js';
import {
  type Cleanup,
  type DirectiveContext,
  type Effect,
  type Part,
  PartType,
  type Primitive,
  type Ref,
  type RefObject,
  type UpdateSession,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export const RefPrimitive: Primitive<Ref<Element>> = {
  name: 'RefPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is Ref<Element> {
    if (!isElementRef(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'The value of RefPrimitive must be a function, object, null or undefined.',
      );
    }
  },
  resolveBinding(
    value: Ref<Element>,
    part: Part,
    _context: DirectiveContext,
  ): RefBinding {
    ensurePartType<Part.AttributePart>(PartType.Attribute, this, value, part);
    return new RefBinding(value, part);
  },
};

export class RefBinding extends PrimitiveBinding<
  Ref<Element>,
  Part.AttributePart
> {
  private _memoizedValue: Ref<Element>;

  private _memoizedCleanup: Cleanup | void = undefined;

  get type(): Primitive<Ref<Element>> {
    return RefPrimitive;
  }

  shouldUpdate(value: Ref<Element>): boolean {
    return value !== this._memoizedValue;
  }

  override attach(session: UpdateSession): void {
    session.frame.layoutEffects.pushBefore(new InvokeRef(this));
  }

  override detach(session: UpdateSession): void {
    session.frame.mutationEffects.pushAfter(new CleanRef(this));
  }

  invokeRef(): void {
    const newRef = this._value;
    const oldRef = this._memoizedValue;

    if (newRef !== oldRef) {
      if (typeof oldRef === 'function') {
        this._memoizedCleanup?.();
        this._memoizedCleanup = undefined;
      } else if (oldRef != null) {
        oldRef.current = null;
      }

      if (typeof newRef === 'function') {
        this._memoizedCleanup = newRef(this.part.node);
      } else if (newRef != null) {
        newRef.current = this.part.node;
      }
    }

    this._memoizedValue = this.value;
  }

  cleanRef(): void {
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

function isElementRef(value: unknown): value is Ref<Element> {
  return (
    value == null ||
    typeof value === 'function' ||
    (value as RefObject<unknown>).current !== undefined
  );
}

class CleanRef implements Effect {
  private readonly _binding: RefBinding;

  constructor(binding: RefBinding) {
    this._binding = binding;
  }

  commit(): void {
    this._binding.cleanRef();
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
