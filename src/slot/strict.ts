import { debugPart, undebugPart } from '../debug/part.js';
import { DirectiveError, SlotSpecifier } from '../directive.js';
import {
  areDirectiveTypesEqual,
  type Binding,
  type DirectiveType,
  type HydrationTarget,
  type Part,
  type Slot,
  type UnwrapBindable,
  type UpdateSession,
} from '../internal.js';

export function Strict<T>(value: T): SlotSpecifier<T> {
  return new SlotSpecifier(StrictSlot, value);
}

export class StrictSlot<T> implements Slot<T> {
  private readonly _binding: Binding<UnwrapBindable<T>>;

  private _dirty = false;

  constructor(binding: Binding<UnwrapBindable<T>>) {
    this._binding = binding;
  }

  get type(): DirectiveType<UnwrapBindable<T>> {
    return this._binding.type;
  }

  get value(): UnwrapBindable<T> {
    return this._binding.value;
  }

  get part(): Part {
    return this._binding.part;
  }

  reconcile(value: T, session: UpdateSession): boolean {
    const directive = session.context.resolveDirective(
      value,
      this._binding.part,
    );

    if (!areDirectiveTypesEqual(this._binding.type, directive.type)) {
      throw new DirectiveError(
        directive.type,
        directive.value,
        this._binding.part,
        `The directive must be ${this._binding.type.name} in this slot, but got ${directive.type.name}.`,
      );
    }

    if (this._dirty || this._binding.shouldBind(directive.value)) {
      this._binding.value = directive.value;
      this._binding.connect(session);
      this._dirty = true;
    }

    return this._dirty;
  }

  hydrate(target: HydrationTarget, session: UpdateSession): void {
    this._binding.hydrate(target, session);
    this._dirty = true;
  }

  connect(session: UpdateSession): void {
    this._binding.connect(session);
    this._dirty = true;
  }

  disconnect(session: UpdateSession): void {
    this._binding.disconnect(session);
    this._dirty = true;
  }

  commit(): void {
    if (!this._dirty) {
      return;
    }

    DEBUG: {
      debugPart(this._binding.part, this._binding.type, this._binding.value);
    }

    this._binding.commit();

    this._dirty = false;
  }

  rollback(): void {
    if (!this._dirty) {
      return;
    }

    this._binding.rollback();

    DEBUG: {
      undebugPart(this._binding.part, this._binding.type);
    }

    this._dirty = false;
  }
}
