import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type UpdateContext,
  createDirectiveElement,
} from '../directive.js';
import type { Part } from '../part.js';

export function memo<T>(value: T): DirectiveElement<T> {
  return createDirectiveElement(SlotDirective as Directive<T>, value);
}

const SlotDirective: Directive<unknown> = {
  get name(): string {
    return 'SlotDirective';
  },
  resolveBinding(
    value: unknown,
    part: Part,
    context: DirectiveContext,
  ): SlotBinding<unknown> {
    const element = context.resolveDirectiveElement(value, part);
    const binding = element.directive.resolveBinding(
      element.value,
      part,
      context,
    );
    return new SlotBinding(binding);
  },
};

export class SlotBinding<T> implements Binding<T> {
  private _pendingBinding: Binding<T>;

  private _memoizedBinding: Binding<T> | null = null;

  private _dirty = false;

  constructor(binding: Binding<T>) {
    this._pendingBinding = binding;
  }

  get directive(): Directive<T> {
    return SlotDirective as Directive<T>;
  }

  get value(): T {
    return this._pendingBinding.value;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  bind(value: T, context: UpdateContext): boolean {
    const element = context.resolveDirectiveElement(
      value,
      this._pendingBinding.part,
    );
    if (this._pendingBinding.directive === element.directive) {
      this._dirty ||= this._pendingBinding.bind(element.value, context);
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
    return this._dirty;
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
