import type {
  Binding,
  DirectiveContext,
  DirectiveType,
  Part,
  UnwrapBindable,
  UpdateSession,
} from './core.js';
import { areDirectiveTypesEqual } from './core.js';
import { debugPart, undebugPart } from './debug/part.js';

export const SLOT_STATUS_IDLE = 0;
export const SLOT_STATUS_ATTACHED = 1;
export const SLOT_STATUS_DETACHED = 2;

export type SlotStatus =
  | typeof SLOT_STATUS_IDLE
  | typeof SLOT_STATUS_ATTACHED
  | typeof SLOT_STATUS_DETACHED;

export class Slot<T> {
  private _pendingBinding: Binding<UnwrapBindable<T>>;

  private _memoizedBinding: Binding<UnwrapBindable<T>> | null = null;

  private _key: unknown;

  private _status: SlotStatus = SLOT_STATUS_IDLE;

  static place<T>(source: T, part: Part, context: DirectiveContext): Slot<T> {
    const { type, value, key } = context.resolveDirective(source, part);
    const binding = type.resolveBinding(value, part, context);
    return new Slot(binding, key);
  }

  constructor(binding: Binding<UnwrapBindable<T>>, key?: unknown) {
    this._pendingBinding = binding;
    this._key = key;
  }

  get type(): DirectiveType<UnwrapBindable<T>> {
    return this._pendingBinding.type;
  }

  get value(): UnwrapBindable<T> {
    return this._pendingBinding.value;
  }

  get key(): unknown {
    return this._key;
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
    const { type, value, key } = context.resolveDirective(
      source,
      this._pendingBinding.part,
    );
    let dirty: boolean;

    if (
      areDirectiveTypesEqual(type, this._pendingBinding.type) &&
      this._key === key
    ) {
      dirty =
        this._status !== SLOT_STATUS_IDLE ||
        this._pendingBinding.shouldUpdate(value);
      if (dirty) {
        this._pendingBinding.value = value;
        this._pendingBinding.attach(session);
        this._status = SLOT_STATUS_ATTACHED;
      }
    } else {
      dirty = true;
      this._pendingBinding.detach(session);
      this._pendingBinding = type.resolveBinding(
        value,
        this._pendingBinding.part,
        context,
      );
      this._pendingBinding.attach(session);
      this._status = SLOT_STATUS_ATTACHED;
    }

    this._key = key;

    return dirty;
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
