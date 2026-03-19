import type {
  Binding,
  DirectiveType,
  Layout,
  Part,
  Slot,
  UnwrapBindable,
  UpdateSession,
} from '../core.js';
import {
  SLOT_STATUS_ATTACHED,
  SLOT_STATUS_DETACHED,
  SLOT_STATUS_IDLE,
  type SlotStatus,
} from '../core.js';
import { debugPart, undebugPart } from '../debug/part.js';
import {
  areDirectiveTypesEqual,
  DirectiveError,
  LayoutModifier,
} from '../directive.js';

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

  private _status: SlotStatus = SLOT_STATUS_IDLE;

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

  get status(): SlotStatus {
    return this._status;
  }

  attach(session: UpdateSession): void {
    this._binding.attach(session);
    this._status = SLOT_STATUS_ATTACHED;
  }

  detach(session: UpdateSession): void {
    this._binding.detach(session);
    this._status = SLOT_STATUS_DETACHED;
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

    const dirty =
      this._status !== SLOT_STATUS_IDLE || this._binding.shouldUpdate(value);

    if (dirty) {
      this._binding.value = value;
      this._binding.attach(session);
      this._status = SLOT_STATUS_ATTACHED;
    }

    return dirty;
  }

  commit(): void {
    if (this._status !== SLOT_STATUS_ATTACHED) {
      return;
    }

    DEBUG: {
      debugPart(this._binding.part, this._binding.type, this._binding.value);
    }

    this._binding.commit();

    this._status = SLOT_STATUS_IDLE;
  }

  rollback(): void {
    if (this._status !== SLOT_STATUS_DETACHED) {
      return;
    }

    this._binding.rollback();

    DEBUG: {
      undebugPart(this._binding.part, this._binding.type);
    }

    this._status = SLOT_STATUS_IDLE;
  }
}
