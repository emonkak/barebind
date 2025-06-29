import {
  type Binding,
  type Directive,
  type Slot,
  SlotObject,
  type UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type Part, PartType } from '../part.js';

export function memo<T>(value: T): SlotObject<T> {
  return new SlotObject(value, MemoSlot);
}

export class MemoSlot<T> implements Slot<T> {
  private _pendingBinding: Binding<unknown>;

  private _memoizedBinding: Binding<unknown> | null = null;

  private readonly _cachedBindings: Map<Directive<unknown>, Binding<unknown>> =
    new Map();

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
      if (this._pendingBinding.shouldBind(element.value)) {
        this._pendingBinding.bind(element.value);
        this._pendingBinding.connect(context);
        this._dirty = true;
      }
    } else {
      this._pendingBinding.disconnect(context);
      this._cachedBindings.set(
        this._pendingBinding.directive,
        this._pendingBinding,
      );
      const cachedBinding = this._cachedBindings.get(element.directive);
      if (cachedBinding !== undefined) {
        if (cachedBinding.shouldBind(element.value)) {
          cachedBinding.bind(element.value);
          cachedBinding.connect(context);
          this._dirty = true;
        }
        this._pendingBinding = cachedBinding;
      } else {
        this._pendingBinding = element.directive.resolveBinding(
          element.value,
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

  commit(): void {
    if (!this._dirty) {
      return;
    }

    if (this._memoizedBinding !== this._pendingBinding) {
      this._memoizedBinding?.rollback();
    }

    DEBUG: {
      if (this._pendingBinding.part.type === PartType.ChildNode) {
        this._pendingBinding.part.node.nodeValue =
          '/' + this._pendingBinding.directive.name;
      }
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

    DEBUG: {
      if (this._pendingBinding.part.type === PartType.ChildNode) {
        this._pendingBinding.part.node.nodeValue = '';
      }
    }

    this._memoizedBinding = null;
    this._dirty = false;
  }
}
