import type {
  Binding,
  DirectiveContext,
  DirectiveType,
  Session,
  UnwrapBindable,
} from './core.js';
import { debugPart, undebugPart } from './dom/debug.js';
import type { DOMPart } from './dom/part.js';

const SLOT_STATUS_IDLE = 0;
const SLOT_STATUS_ATTACHED = 1;
const SLOT_STATUS_DETACHED = 2;

type SlotStatus =
  | typeof SLOT_STATUS_IDLE
  | typeof SLOT_STATUS_ATTACHED
  | typeof SLOT_STATUS_DETACHED;

export class Slot<TSource, TPart = unknown, TRenderer = unknown> {
  private _pendingBinding: Binding<UnwrapBindable<TSource>, TPart, TRenderer>;

  private _currentBinding: Binding<
    UnwrapBindable<TSource>,
    TPart,
    TRenderer
  > | null = null;

  private _key: unknown;

  private _status: SlotStatus = SLOT_STATUS_IDLE;

  static place<TSource, TPart, TRenderer>(
    source: TSource,
    part: TPart,
    context: DirectiveContext<TPart, TRenderer>,
  ): Slot<TSource, TPart, TRenderer> {
    const { type, value, key } = context.resolveDirective(source, part);
    const binding = type.resolveBinding(value, part, context);
    return new Slot(binding, key);
  }

  constructor(
    binding: Binding<UnwrapBindable<TSource>, TPart, TRenderer>,
    key?: unknown,
  ) {
    this._pendingBinding = binding;
    this._key = key;
  }

  get type(): DirectiveType<UnwrapBindable<TSource>, TPart, TRenderer> {
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

  attach(session: Session<TPart, TRenderer>): void {
    this._pendingBinding.attach(session);
    this._status = SLOT_STATUS_ATTACHED;
  }

  detach(session: Session<TPart, TRenderer>): void {
    this._pendingBinding.detach(session);
    this._status = SLOT_STATUS_DETACHED;
  }

  update(source: TSource, session: Session<TPart, TRenderer>): boolean {
    const { context } = session;
    const { type, value, key } = context.resolveDirective(
      source,
      this._pendingBinding.part,
    );
    let dirty: boolean;

    if (type === this._pendingBinding.type && key === this._key) {
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
          undebugPart(oldBinding.part as DOMPart, oldBinding.type);
        }
      }
    }

    DEBUG: {
      debugPart(newBinding.part as DOMPart, newBinding.type, newBinding.value);
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
        undebugPart(binding.part as DOMPart, binding.type);
      }
    }

    this._currentBinding = null;
    this._status = SLOT_STATUS_IDLE;
  }
}
