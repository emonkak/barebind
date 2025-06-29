import { inspectPart, markUsedValue } from '../debug.js';
import {
  type Binding,
  type Directive,
  type EffectContext,
  type Slot,
  SlotObject,
  type UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import type { Part } from '../part.js';

export function strict<T>(value: T): SlotObject<T> {
  return new SlotObject(value, StrictSlot);
}

export class StrictSlot<T> implements Slot<T> {
  private readonly _binding: Binding<unknown>;

  private _dirty = false;

  constructor(binding: Binding<unknown>) {
    this._binding = binding;
  }

  get directive(): Directive<unknown> {
    return this._binding.directive;
  }

  get value(): unknown {
    return this._binding.value;
  }

  get part(): Part {
    return this._binding.part;
  }

  reconcile(value: T, context: UpdateContext): void {
    const element = context.resolveDirective(value, this._binding.part);
    if (this._binding.directive !== element.directive) {
      throw new Error(
        `The directive must be ${this._binding.directive.name} in this slot, but got ${element.directive.name}.\n` +
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

  commit(context: EffectContext): void {
    if (!this._dirty) {
      return;
    }

    DEBUG: {
      context.debugValue(
        this._binding.directive,
        this._binding.value,
        this._binding.part,
      );
    }

    this._binding.commit(context);

    this._dirty = false;
  }

  rollback(context: EffectContext): void {
    if (!this._dirty) {
      return;
    }

    this._binding.rollback(context);

    DEBUG: {
      context.undebugValue(
        this._binding.directive,
        this._binding.value,
        this._binding.part,
      );
    }

    this._dirty = false;
  }
}
