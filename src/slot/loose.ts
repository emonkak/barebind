import {
  type Binding,
  type CommitContext,
  type Directive,
  type Slot,
  SlotObject,
  type UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import type { Part } from '../part.js';

export function loose<T>(value: T): SlotObject<T> {
  return new SlotObject(value, LooseSlot);
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
    if (this._pendingBinding.directive === element.directive) {
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

    if (this._memoizedBinding !== this._pendingBinding) {
      if (this._memoizedBinding !== null) {
        this._memoizedBinding.rollback(context);

        DEBUG: {
          context.undebugValue(
            this._memoizedBinding.directive,
            this._memoizedBinding.value,
            this._memoizedBinding.part,
          );
        }
      }
    }

    DEBUG: {
      context.debugValue(
        this._pendingBinding.directive,
        this._pendingBinding.value,
        this._pendingBinding.part,
      );
    }

    this._pendingBinding.commit(context);

    this._memoizedBinding = this._pendingBinding;
    this._dirty = false;
  }

  rollback(context: CommitContext): void {
    if (!this._dirty) {
      return;
    }

    if (this._memoizedBinding !== null) {
      this._memoizedBinding.rollback(context);

      DEBUG: {
        context.undebugValue(
          this._memoizedBinding.directive,
          this._memoizedBinding.value,
          this._memoizedBinding.part,
        );
      }
    }

    this._memoizedBinding = null;
    this._dirty = false;
  }
}
