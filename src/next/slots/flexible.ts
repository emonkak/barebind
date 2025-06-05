import {
  type Bindable,
  type Binding,
  type Directive,
  type Slot,
  type SlotElement,
  type UpdateContext,
  createSlotElement,
} from '../core.js';
import type { HydrationTree } from '../hydration.js';
import type { Part } from '../part.js';

export function flexible<T>(value: Bindable<T>): SlotElement<T> {
  return createSlotElement(value, FlexibleSlot);
}

export class FlexibleSlot<T> implements Slot<T> {
  private _pendingBinding: Binding<T>;

  private _memoizedBinding: Binding<T> | null = null;

  private _dirty = false;

  constructor(binding: Binding<T>) {
    this._pendingBinding = binding;
  }

  get directive(): Directive<T> {
    return this._pendingBinding.directive;
  }

  get value(): T {
    return this._pendingBinding.value;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  reconcile(value: Bindable<T>, context: UpdateContext): void {
    const element = context.resolveDirective(value, this._pendingBinding.part);
    if (this._pendingBinding.directive === element.directive) {
      if (this._pendingBinding.shouldBind(element.value)) {
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

  commit(): void {
    if (!this._dirty) {
      return;
    }
    if (this._memoizedBinding !== this._pendingBinding) {
      this._memoizedBinding?.rollback();
    }
    this._pendingBinding.commit();
    this._memoizedBinding = this._pendingBinding;
    this._dirty = false;
  }

  rollback(): void {
    if (!this._dirty) {
      return;
    }
    this._memoizedBinding?.rollback();
    this._memoizedBinding = null;
    this._dirty = false;
  }
}
