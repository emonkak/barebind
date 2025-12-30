import { DirectiveError } from '../directive.js';
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

export class RefPrimitive implements Primitive<Ref<Element>> {
  static readonly instance: RefPrimitive = new RefPrimitive();

  ensureValue(value: unknown, part: Part): asserts value is Ref<Element> {
    if (!isElementRef(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'The value of RefPrimitive must be a function, object or null.',
      );
    }
  }

  resolveBinding(
    ref: Ref<Element>,
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
  Ref<Element>,
  Part.AttributePart
> {
  private _memoizedValue: Ref<Element> = null;

  private _memoizedCleanup: Cleanup | void = undefined;

  get type(): Primitive<Ref<Element>> {
    return RefPrimitive.instance;
  }

  shouldUpdate(ref: Ref<Element>): boolean {
    return ref !== this._memoizedValue;
  }

  override attach(session: UpdateSession): void {
    session.frame.layoutEffects.push(new InvokeRef(this));
  }

  override detach(session: UpdateSession): void {
    session.frame.layoutEffects.push(new CleanRef(this));
  }

  commit(): void {}

  rollback(): void {}

  invokeRef(): void {
    const newRef = this._value;
    const oldRef = this._memoizedValue;

    if (newRef !== oldRef) {
      if (typeof oldRef === 'function') {
        this._memoizedCleanup?.();
        this._memoizedCleanup = undefined;
      } else if (oldRef !== null) {
        oldRef.current = null;
      }

      if (typeof newRef === 'function') {
        this._memoizedCleanup = newRef(this.part.node);
      } else if (newRef !== null) {
        newRef.current = this.part.node;
      }
    }

    this._memoizedValue = this.value;
  }

  cleanRef(): void {
    const ref = this._memoizedValue;

    if (ref !== null) {
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
    typeof value === 'function' ||
    (typeof value === 'object' && value === null) ||
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
