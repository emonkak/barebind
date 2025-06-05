import {
  type Bindable,
  type Binding,
  type Directive,
  type Slot,
  type SlotElement,
  type UpdateContext,
  createSlotElement,
} from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import type { HydrationTree } from '../hydration.js';
import type { Part } from '../part.js';

export function strict<T>(value: Bindable<T>): SlotElement<T> {
  return createSlotElement(value, StrictSlot);
}

export class StrictSlot<T> implements Slot<T> {
  private readonly _binding: Binding<T>;

  private _dirty = false;

  constructor(binding: Binding<T>) {
    this._binding = binding;
  }

  get directive(): Directive<T> {
    return this._binding.directive;
  }

  get value(): T {
    return this._binding.value;
  }

  get part(): Part {
    return this._binding.part;
  }

  reconcile(value: Bindable<T>, context: UpdateContext): void {
    const element = context.resolveDirective(value, this._binding.part);
    if (this._binding.directive !== element.directive) {
      throw new Error(
        `The value must have ${this._binding.directive.name}, but got ${element.directive.name}.\n` +
          inspectPart(this._binding.part, markUsedValue(element.value)),
      );
    }
    if (this._binding.shouldBind(element.value)) {
      this._binding.bind(element.value);
      this._binding.connect(context);
      this._dirty = true;
    }
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    this._binding.hydrate(hydrationTree, context);
    this._dirty = true;
  }

  connect(context: UpdateContext): void {
    this._binding.connect(context);
    this._dirty = true;
  }

  disconnect(context: UpdateContext): void {
    this._binding.disconnect(context);
    this._dirty = true;
  }

  commit(): void {
    if (!this._dirty) {
      return;
    }
    this._binding.commit();
    this._dirty = false;
  }

  rollback(): void {
    if (!this._dirty) {
      return;
    }
    this._binding.rollback();
    this._dirty = false;
  }
}
