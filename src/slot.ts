import type {
  Binding,
  DirectiveContext,
  DirectiveType,
  Part,
  Session,
  UnwrapBindable,
} from './core.js';
import { areDirectiveTypesEqual } from './core.js';
import { debugPart, undebugPart } from './debug/dom.js';

const SLOT_STATUS_IDLE = 0;
const SLOT_STATUS_ATTACHED = 1;
const SLOT_STATUS_DETACHED = 2;

type SlotStatus =
  | typeof SLOT_STATUS_IDLE
  | typeof SLOT_STATUS_ATTACHED
  | typeof SLOT_STATUS_DETACHED;

export class Slot<TSource, TPart extends Part = Part> {
  private _pendingBinding: Binding<UnwrapBindable<TSource>, TPart>;

  private _currentBinding: Binding<UnwrapBindable<TSource>, TPart> | null =
    null;

  private _key: unknown;

  private _status: SlotStatus = SLOT_STATUS_IDLE;

  static place<TSource, TPart extends Part>(
    source: TSource,
    part: TPart,
    context: DirectiveContext,
  ): Slot<TSource, TPart> {
    const { type, value, key } = context.resolveDirective(source, part);
    const binding = type.resolveBinding(value, part, context);
    return new Slot(binding, key);
  }

  constructor(binding: Binding<UnwrapBindable<TSource>, TPart>, key?: unknown) {
    this._pendingBinding = binding;
    this._key = key;
  }

  get type(): DirectiveType<UnwrapBindable<TSource>, Part> {
    return this._pendingBinding.type;
  }

  get value(): UnwrapBindable<TSource> {
    return this._pendingBinding.value;
  }

  get part(): TPart {
    return this._pendingBinding.part;
  }

  get key(): unknown {
    return this._key;
  }

  attach(session: Session): void {
    this._pendingBinding.attach(session);
    this._status = SLOT_STATUS_ATTACHED;
  }

  detach(session: Session): void {
    this._pendingBinding.detach(session);
    this._status = SLOT_STATUS_DETACHED;
  }

  update(source: TSource, session: Session): boolean {
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
    const oldBinding = this._currentBinding;

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

    this._currentBinding = newBinding;
    this._status = SLOT_STATUS_IDLE;
  }

  rollback(): void {
    if (this._status !== SLOT_STATUS_DETACHED) {
      return;
    }

    const binding = this._currentBinding;

    if (binding !== null) {
      binding.rollback();

      DEBUG: {
        undebugPart(binding.part, binding.type);
      }
    }

    this._currentBinding = null;
    this._status = SLOT_STATUS_IDLE;
  }
}
