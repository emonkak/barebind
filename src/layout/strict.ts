import { debugPart, undebugPart } from '../debug/part.js';
import { DirectiveError, LayoutModifier } from '../directive.js';
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
import { SlotStatus } from './layout.js';

export function Strict<T>(source: T): LayoutModifier<T> {
  return new LayoutModifier(source, StrictLayout);
}

export const StrictLayout: Layout = {
  name: 'StrictLayout',
  compose(): Layout {
    return this;
  },
  placeBinding<T>(binding: Binding<UnwrapBindable<T>>): StrictSlot<T> {
    return new StrictSlot(binding);
  },
};

export class StrictSlot<T> implements Slot<T> {
  private readonly _binding: Binding<UnwrapBindable<T>>;

  private _status: SlotStatus = SlotStatus.Idle;

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

  reconcile(source: T, session: UpdateSession): boolean {
    const { context } = session;
    const { type, value } = context.resolveDirective(
      source,
      this._binding.part,
    );

    if (!areDirectiveTypesEqual(type, this._binding.type)) {
      throw new DirectiveError(
        type,
        value,
        this._binding.part,
        `The directive type must be ${this._binding.type.name} in the slot, but got ${type.name}.`,
      );
    }

    if (this._status !== SlotStatus.Idle || this._binding.shouldUpdate(value)) {
      this._binding.value = value;
      this._binding.attach(session);
      this._status = SlotStatus.Attached;
    }

    return this._status === SlotStatus.Attached;
  }

  attach(session: UpdateSession): void {
    this._binding.attach(session);
    this._status = SlotStatus.Attached;
  }

  detach(session: UpdateSession): void {
    this._binding.detach(session);
    this._status = SlotStatus.Detached;
  }

  commit(): void {
    if (this._status !== SlotStatus.Attached) {
      return;
    }

    DEBUG: {
      debugPart(this._binding.part, this._binding.type, this._binding.value);
    }

    this._binding.commit();

    this._status = SlotStatus.Idle;
  }

  rollback(): void {
    if (this._status !== SlotStatus.Detached) {
      return;
    }

    this._binding.rollback();

    DEBUG: {
      undebugPart(this._binding.part, this._binding.type);
    }

    this._status = SlotStatus.Idle;
  }
}
