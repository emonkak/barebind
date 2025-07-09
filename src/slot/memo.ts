import {
  $toDirective,
  areDirectiveTypesEqual,
  type Binding,
  type CommitContext,
  type DirectiveType,
  isBindable,
  type Slot,
  SlotSpecifier,
  type UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import type { Part } from '../part.js';

export function memo<T>(value: T): SlotSpecifier<T> {
  return new SlotSpecifier(MemoSlot, value);
}

export class MemoSlot<T> implements Slot<T> {
  private _pendingBinding: Binding<unknown>;

  private _memoizedBinding: Binding<unknown> | null = null;

  private readonly _cachedBindings: Map<
    DirectiveType<unknown>,
    Binding<unknown>
  > = new Map();

  private _dirty = false;

  constructor(binding: Binding<unknown>) {
    this._pendingBinding = binding;
  }

  get type(): DirectiveType<unknown> {
    return this._pendingBinding.type;
  }

  get value(): unknown {
    return this._pendingBinding.value;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  reconcile(value: T, context: UpdateContext): void {
    const directive = isBindable(value)
      ? value[$toDirective]()
      : context.resolveDirective(value, this._pendingBinding.part);
    if (areDirectiveTypesEqual(this._pendingBinding.type, directive.type)) {
      if (this._dirty || this._pendingBinding.shouldBind(directive.value)) {
        this._pendingBinding.bind(directive.value);
        this._pendingBinding.connect(context);
        this._dirty = true;
      }
    } else {
      this._pendingBinding.disconnect(context);
      this._cachedBindings.set(this._pendingBinding.type, this._pendingBinding);
      const cachedBinding = this._cachedBindings.get(directive.type);
      if (cachedBinding !== undefined) {
        if (cachedBinding.shouldBind(directive.value)) {
          cachedBinding.bind(directive.value);
          cachedBinding.connect(context);
          this._dirty = true;
        }
        this._pendingBinding = cachedBinding;
      } else {
        this._pendingBinding = directive.type.resolveBinding(
          directive.value,
          this._pendingBinding.part,
          context,
        );
        this._pendingBinding.connect(context);
        this._dirty = true;
      }
    }
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    this._pendingBinding.hydrate(hydrationTree, context);
    this._dirty = true;
  }

  connect(context: UpdateContext): void {
    this._pendingBinding.connect(context);
    this._dirty = true;
  }

  disconnect(context: UpdateContext): void {
    this._pendingBinding.disconnect(context);
    this._dirty = true;
  }

  commit(context: CommitContext): void {
    if (!this._dirty) {
      return;
    }

    const newBinding = this._pendingBinding;
    const oldBinding = this._memoizedBinding;

    if (oldBinding !== newBinding) {
      if (oldBinding !== null) {
        oldBinding.rollback(context);

        DEBUG: {
          context.undebugValue(
            oldBinding.type,
            oldBinding.value,
            oldBinding.part,
          );
        }
      }
    }

    DEBUG: {
      context.debugValue(newBinding.type, newBinding.value, newBinding.part);
    }

    newBinding.commit(context);

    this._memoizedBinding = newBinding;
    this._dirty = false;
  }

  rollback(context: CommitContext): void {
    if (!this._dirty) {
      return;
    }

    const binding = this._memoizedBinding;

    if (binding !== null) {
      binding.rollback(context);

      DEBUG: {
        context.undebugValue(binding.type, binding.value, binding.part);
      }
    }

    this._memoizedBinding = null;
    this._dirty = false;
  }
}
