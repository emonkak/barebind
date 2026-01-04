import { debugPart, undebugPart } from '../debug/part.js';
import { DirectiveError } from '../directive.js';
import {
  areDirectiveTypesEqual,
  type Binding,
  type DirectiveType,
  type Layout,
  type Part,
  type Slot,
  type UnwrapBindable,
  type UpdateSession,
} from '../internal.js';
import { LayoutSpecifier } from './layout.js';

export function Strict<T>(value: T): LayoutSpecifier<T> {
  return new LayoutSpecifier(StrictLayout, value);
}

export const StrictLayout: Layout = {
  displayName: 'StrictLayout',
  resolveSlot<T>(binding: Binding<UnwrapBindable<T>>): StrictSlot<T> {
    return new StrictSlot(binding);
  },
};

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
    const { context } = session;
    const directive = context.resolveDirective(value, this._binding.part);

    if (!areDirectiveTypesEqual(directive.type, this._binding.type)) {
      throw new DirectiveError(
        directive.type,
        directive.value,
        this._binding.part,
        `The directive type must be ${this._binding.type.displayName} in this slot, but got ${directive.type.displayName}.`,
      );
    }

    if (this._dirty || this._binding.shouldUpdate(directive.value)) {
      this._binding.value = directive.value;
      this._binding.attach(session);
      this._dirty = true;
    }

    return this._dirty;
  }

  attach(session: UpdateSession): void {
    this._binding.attach(session);
    this._dirty = true;
  }

  detach(session: UpdateSession): void {
    this._binding.detach(session);
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
