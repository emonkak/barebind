import {
  areDirectivesEqual,
  type Binding,
  type CommitContext,
  type Directive,
  type Slot,
  SlotSpecifier,
  type UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import type { Part } from '../part.js';

export function loose<T>(value: T): SlotSpecifier<T> {
  return new SlotSpecifier(value, LooseSlot);
}

export class LooseSlot<T> implements Slot<T> {
  private _pendingBinding: Binding<unknown>;

  private _memoizedBinding: Binding<unknown> | null = null;

  private _dirty = false;

  constructor(binding: Binding<unknown>) {
    this._pendingBinding = binding;
  }

  get directive(): Directive<unknown> {
    return this._pendingBinding.directive;
  }

  get value(): unknown {
    return this._pendingBinding.value;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  reconcile(value: T, context: UpdateContext): void {
    const element = context.resolveDirective(value, this._pendingBinding.part);
    if (areDirectivesEqual(this._pendingBinding.directive, element.directive)) {
      if (this._dirty || this._pendingBinding.shouldBind(element.value)) {
        this._pendingBinding.bind(element.value);
        this._pendingBinding.connect(context);
        this._dirty = true;
      }
    } else {
      this._pendingBinding.disconnect(context);
      this._pendingBinding = element.directive.resolveBinding(
        element.value,
        this._pendingBinding.part,
        context,
      );
      this._pendingBinding.connect(context);
      this._dirty = true;
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
            oldBinding.directive,
            oldBinding.value,
            oldBinding.part,
          );
        }
      }
    }

    DEBUG: {
      context.debugValue(
        newBinding.directive,
        newBinding.value,
        newBinding.part,
      );
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
        context.undebugValue(binding.directive, binding.value, binding.part);
      }
    }

    this._memoizedBinding = null;
    this._dirty = false;
  }
}
