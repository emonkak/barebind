import { debugPart, undebugPart } from '../debug/part.js';
import { LayoutModifier } from '../directive.js';
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

export function Loose<T>(source: T): LayoutModifier<T> {
  return new LayoutModifier(source, LooseLayout);
}

export const LooseLayout: Layout = {
  name: 'LooseLayout',
  compose(): Layout {
    return this;
  },
  placeBinding<T>(binding: Binding<UnwrapBindable<T>>): LooseSlot<T> {
    return new LooseSlot(binding);
  },
};

export class LooseSlot<T> implements Slot<T> {
  private _pendingBinding: Binding<UnwrapBindable<T>>;

  private _memoizedBinding: Binding<UnwrapBindable<T>> | null = null;

  private _status: SlotStatus = SlotStatus.Idle;

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

  reconcile(source: T, session: UpdateSession): boolean {
    const { context } = session;
    const { type, value } = context.resolveDirective(
      source,
      this._pendingBinding.part,
    );

    if (areDirectiveTypesEqual(type, this._pendingBinding.type)) {
      if (
        this._status !== SlotStatus.Idle ||
        this._pendingBinding.shouldUpdate(value)
      ) {
        this._pendingBinding.value = value;
        this._pendingBinding.attach(session);
        this._status = SlotStatus.Attached;
      }
    } else {
      this._pendingBinding.detach(session);
      this._pendingBinding = type.resolveBinding(
        value,
        this._pendingBinding.part,
        context,
      );
      this._pendingBinding.attach(session);
      this._status = SlotStatus.Attached;
    }

    return this._status === SlotStatus.Attached;
  }

  attach(session: UpdateSession): void {
    this._pendingBinding.attach(session);
    this._status = SlotStatus.Attached;
  }

  detach(session: UpdateSession): void {
    this._pendingBinding.detach(session);
    this._status = SlotStatus.Detached;
  }

  commit(): void {
    if (this._status !== SlotStatus.Attached) {
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
    this._status = SlotStatus.Idle;
  }

  rollback(): void {
    if (this._status !== SlotStatus.Detached) {
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
    this._status = SlotStatus.Idle;
  }
}
