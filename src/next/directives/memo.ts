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
    const element = context.resolveDirectiveElement(value, part);
    const binding = element.directive.resolveBinding(
      element.value,
      part,
      context,
    );
    return new MemoBinding(binding);
  },
};

export class MemoBinding<T> implements Binding<T> {
  private _pendingBinding: Binding<T>;

  private _memoizedBinding: Binding<T> | null = null;

  private readonly _cachedBindings: Map<Directive<T>, Binding<T>> = new Map();

  private _dirty = false;

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

  shouldBind(_value: T): boolean {
    return true;
  }

  bind(value: T, context: UpdateContext): void {
    const element = context.resolveDirectiveElement(
      value,
      this._pendingBinding.part,
    );
    if (this._pendingBinding.directive === element.directive) {
      if (this._pendingBinding.shouldBind(element.value)) {
        this._pendingBinding.bind(element.value, context);
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
          cachedBinding.bind(element.value, context);
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
