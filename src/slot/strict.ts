import { inspectPart, markUsedValue } from '../debug.js';
import {
  type Bindable,
  type Binding,
  type Directive,
  type Slot,
  SlotObject,
  type UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type Part, PartType } from '../part.js';

export function strict<T>(value: Bindable<T>): SlotObject<T> {
  return new SlotObject(value, StrictSlot);
}

/**
 * @internal
 */
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

  commit(): void {
    if (!this._dirty) {
      return;
    }

    DEBUG: {
      if (this._binding.part.type === PartType.ChildNode) {
        this._binding.part.node.nodeValue = '/' + this._binding.directive.name;
      }
    }

    this._binding.commit();

    this._dirty = false;
  }

  rollback(): void {
    if (!this._dirty) {
      return;
    }

    this._binding.rollback();

    DEBUG: {
      if (this._binding.part.type === PartType.ChildNode) {
        this._binding.part.node.nodeValue = '';
      }
    }

    this._dirty = false;
  }
}
