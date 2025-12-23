import { debugPart, undebugPart } from '../debug/part.js';
import { LayoutSpecifier } from '../directive.js';
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

export function Flexible<T>(value: T): LayoutSpecifier<T> {
  return new LayoutSpecifier(FlexibleLayout.instance, value);
}

export class FlexibleLayout implements Layout {
  static readonly instance: FlexibleLayout = new FlexibleLayout();

  resolveSlot<T>(binding: Binding<UnwrapBindable<T>>): FlexibleSlot<T> {
    return new FlexibleSlot(binding);
  }
}

export class FlexibleSlot<T> implements Slot<T> {
  private _pendingBinding: Binding<UnwrapBindable<T>>;

  private _memoizedBinding: Binding<UnwrapBindable<T>> | null = null;

  private _reservedBinding: Binding<UnwrapBindable<T>> | null = null;

  private _dirty = false;

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

  reconcile(value: T, session: UpdateSession): boolean {
    const { context } = session;
    const directive = context.resolveDirective(
      value,
      this._pendingBinding.part,
    );

    if (areDirectiveTypesEqual(directive.type, this._pendingBinding.type)) {
      if (this._dirty || this._pendingBinding.shouldUpdate(directive.value)) {
        this._pendingBinding.value = directive.value;
        this._pendingBinding.attach(session);
        this._dirty = true;
      }
    } else {
      const reservedBinding = this._reservedBinding;

      this._pendingBinding.detach(session);
      this._reservedBinding = this._pendingBinding;

      if (
        reservedBinding !== null &&
        areDirectiveTypesEqual(reservedBinding.type, directive.type)
      ) {
        reservedBinding.value = directive.value;
        reservedBinding.attach(session);
        this._pendingBinding = reservedBinding;
      } else {
        this._pendingBinding = directive.type.resolveBinding(
          directive.value,
          this._pendingBinding.part,
          context,
        );
        this._pendingBinding.attach(session);
      }

      this._dirty = true;
    }

    return this._dirty;
  }

  attach(session: UpdateSession): void {
    this._pendingBinding.attach(session);
    this._dirty = true;
  }

  detach(session: UpdateSession): void {
    this._pendingBinding.detach(session);
    this._dirty = true;
  }

  commit(): void {
    if (!this._dirty) {
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
    this._dirty = false;
  }

  rollback(): void {
    if (!this._dirty) {
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
    this._dirty = false;
  }
}
