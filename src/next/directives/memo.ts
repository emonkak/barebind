import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type UpdateContext,
  createDirectiveElement,
} from '../core.js';
import type { Part } from '../part.js';

export function memo<T>(value: T): DirectiveElement<T> {
  return createDirectiveElement(MemoDirective as Directive<T>, value);
}

const MemoDirective: Directive<unknown> = {
  get name(): string {
    return 'MemoDirective';
  },
  resolveBinding(
    value: unknown,
    part: Part,
    context: DirectiveContext,
  ): MemoBinding<unknown> {
    const binding = context.resolveBinding(value, part);
    return new MemoBinding(binding);
  },
};

class MemoBinding<T> implements Binding<T> {
  private _pendingBinding: Binding<T>;

  private _memoizedBinding: Binding<T> | null = null;

  private readonly _cachedBindings: Map<Directive<T>, Binding<T>> = new Map();

  constructor(binding: Binding<T>) {
    this._pendingBinding = binding;
  }

  get directive(): Directive<T> {
    return MemoDirective as Directive<T>;
  }

  get value(): T {
    return this._pendingBinding.value;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  connect(context: UpdateContext): void {
    this._pendingBinding.connect(context);
  }

  bind(value: T, context: UpdateContext): void {
    const binding = this._pendingBinding;
    const element = context.resolveDirectiveElement(value, binding.part);
    if (binding.directive === element.directive) {
      this._pendingBinding.bind(element.value, context);
    } else {
      const cachedBinding = this._cachedBindings.get(element.directive);
      binding.disconnect(context);
      if (cachedBinding !== undefined) {
        cachedBinding.bind(element.value, context);
        this._pendingBinding = cachedBinding;
      } else {
        this._pendingBinding = element.directive.resolveBinding(
          element.value,
          binding.part,
          context,
        );
        this._pendingBinding.connect(context);
      }
      this._cachedBindings.set(binding.directive, binding);
    }
  }

  disconnect(context: UpdateContext): void {
    this._memoizedBinding?.disconnect(context);
  }

  commit(): void {
    if (this._memoizedBinding !== this._pendingBinding) {
      this._memoizedBinding?.rollback();
    }
    this._pendingBinding.commit();
    this._memoizedBinding = this._pendingBinding;
  }

  rollback(): void {
    this._memoizedBinding?.rollback();
    this._memoizedBinding = null;
  }
}
