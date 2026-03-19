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
import { areDirectiveTypesEqual, LayoutModifier } from '../directive.js';

export function Flexible<T>(source: T): LayoutModifier<T> {
  return new LayoutModifier(source, FlexibleLayout);
}

export const FlexibleLayout: Layout = {
  name: 'FlexibleLayout',
  compose(): Layout {
    return this;
  },
  placeBinding<T>(binding: Binding<UnwrapBindable<T>>): FlexibleSlot<T> {
    return new FlexibleSlot(binding);
  },
};

export class FlexibleSlot<T> implements Slot<T> {
  private _pendingBinding: Binding<UnwrapBindable<T>>;

  private _memoizedBinding: Binding<UnwrapBindable<T>> | null = null;

  private _cachedBinding: Binding<UnwrapBindable<T>> | null = null;

  private _status: SlotStatus = SLOT_STATUS_IDLE;

  constructor(binding: Binding<UnwrapBindable<T>>) {
    this._pendingBinding = binding;
  }

  get type(): DirectiveType<UnwrapBindable<T>> {
    return this._pendingBinding.type;
  }

  get value(): UnwrapBindable<T> {
    return this._pendingBinding.value;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  get status(): SlotStatus {
    return this._status;
  }

  attach(session: UpdateSession): void {
    this._pendingBinding.attach(session);
    this._status = SLOT_STATUS_ATTACHED;
  }

  detach(session: UpdateSession): void {
    this._pendingBinding.detach(session);
    this._status = SLOT_STATUS_DETACHED;
  }

  reconcile(source: T, session: UpdateSession): boolean {
    const { context } = session;
    const { type, value } = context.resolveDirective(
      source,
      this._pendingBinding.part,
    );

    if (areDirectiveTypesEqual(type, this._pendingBinding.type)) {
      const dirty =
        this._status !== SLOT_STATUS_IDLE ||
        this._pendingBinding.shouldUpdate(value);
      if (dirty) {
        this._pendingBinding.value = value;
        this._pendingBinding.attach(session);
        this._status = SLOT_STATUS_ATTACHED;
      }
      return dirty;
    } else {
      const cachedBinding = this._cachedBinding;

      this._pendingBinding.detach(session);
      this._cachedBinding = this._pendingBinding;

      if (
        cachedBinding !== null &&
        areDirectiveTypesEqual(cachedBinding.type, type)
      ) {
        cachedBinding.value = value;
        cachedBinding.attach(session);
        this._pendingBinding = cachedBinding;
      } else {
        this._pendingBinding = type.resolveBinding(
          value,
          this._pendingBinding.part,
          context,
        );
        this._pendingBinding.attach(session);
      }

      this._status = SLOT_STATUS_ATTACHED;

      return true;
    }
  }

  commit(): void {
    if (this._status !== SLOT_STATUS_ATTACHED) {
      return;
    }

    const newBinding = this._pendingBinding;
    const oldBinding = this._memoizedBinding;

    if (newBinding !== oldBinding) {
      if (oldBinding !== null) {
        oldBinding.rollback();

        DEBUG: {
          undebugPart(oldBinding.part, oldBinding.type);
        }
      }
    }

    DEBUG: {
      debugPart(newBinding.part, newBinding.type, newBinding.value);
    }

    newBinding.commit();

    this._memoizedBinding = newBinding;
    this._status = SLOT_STATUS_IDLE;
  }

  rollback(): void {
    if (this._status !== SLOT_STATUS_DETACHED) {
      return;
    }

    const binding = this._memoizedBinding;

    if (binding !== null) {
      binding.rollback();

      DEBUG: {
        undebugPart(binding.part, binding.type);
      }
    }

    this._memoizedBinding = null;
    this._status = SLOT_STATUS_IDLE;
  }
}
