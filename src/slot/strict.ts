import { inspectPart, markUsedValue } from '../debug.js';
import {
  areDirectiveTypesEqual,
  type Binding,
  type CommitContext,
  type DirectiveType,
  type Slot,
  SlotSpecifier,
  type UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import type { Part } from '../part.js';

export function strict<T>(value: T): SlotSpecifier<T> {
  return new SlotSpecifier(StrictSlot, value);
}

export class StrictSlot<T> implements Slot<T> {
  private readonly _binding: Binding<unknown>;

  private _dirty = false;

  constructor(binding: Binding<unknown>) {
    this._binding = binding;
  }

  get type(): DirectiveType<unknown> {
    return this._binding.type;
  }

  get value(): unknown {
    return this._binding.value;
  }

  get part(): Part {
    return this._binding.part;
  }

  reconcile(value: T, context: UpdateContext): void {
    const directive = context.resolveDirective(value, this._binding.part);
    if (!areDirectiveTypesEqual(this._binding.type, directive.type)) {
      throw new Error(
        `The directive must be ${this._binding.type.displayName} in this slot, but got ${directive.type.displayName}.\n` +
          inspectPart(this._binding.part, markUsedValue(directive.value)),
      );
    }
    if (this._dirty || this._binding.shouldBind(directive.value)) {
      this._binding.bind(directive.value);
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

  commit(context: CommitContext): void {
    if (!this._dirty) {
      return;
    }

    DEBUG: {
      context.debugValue(
        this._binding.type,
        this._binding.value,
        this._binding.part,
      );
    }

    this._binding.commit(context);

    this._dirty = false;
  }

  rollback(context: CommitContext): void {
    if (!this._dirty) {
      return;
    }

    this._binding.rollback(context);

    DEBUG: {
      context.undebugValue(
        this._binding.type,
        this._binding.value,
        this._binding.part,
      );
    }

    this._dirty = false;
  }
}
