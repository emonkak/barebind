import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type EffectContext,
  type UpdateContext,
  createDirectiveElement,
} from './coreTypes.js';
import type { Part } from './part.js';

export function memo<T>(value: T): DirectiveElement<T> {
  return createDirectiveElement(Memo as Directive<T>, value);
}

const Memo: Directive<unknown> = {
  get name(): string {
    return 'Memo';
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

const enum MemoStatus {
  Idle,
  Mounting,
  Unmouting,
}

class MemoBinding<T> implements Binding<T> {
  private _pendingBinding: Binding<T>;

  private _memoizedBinding: Binding<T> | null = null;

  private readonly _memoizedBindings: Map<Directive<T>, Binding<T>> = new Map();

  private _status: MemoStatus = MemoStatus.Idle;

  constructor(binding: Binding<T>) {
    this._pendingBinding = binding;
  }

  get directive(): Directive<T> {
    return Memo as Directive<T>;
  }

  get value(): T {
    return this._pendingBinding.value;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  connect(context: UpdateContext): void {
    this._pendingBinding.connect(context);
    this._status = MemoStatus.Idle;
  }

  bind(value: T, context: UpdateContext): void {
    const binding = this._pendingBinding;
    const element = context.resolveDirectiveElement(value, binding.part);
    if (binding.directive === element.directive) {
      this._pendingBinding.bind(element.value, context);
    } else {
      const memoizedBinding = this._memoizedBindings.get(element.directive);
      binding.unbind(context);
      context.enqueueMutationEffect(binding);
      if (memoizedBinding !== undefined) {
        memoizedBinding.bind(element.value, context);
        this._pendingBinding = memoizedBinding;
      } else {
        this._pendingBinding = element.directive.resolveBinding(
          element.value,
          binding.part,
          context,
        );
        this._pendingBinding.connect(context);
      }
      this._memoizedBindings.set(binding.directive, binding);
    }
    this._status = MemoStatus.Mounting;
  }

  unbind(context: UpdateContext): void {
    this._memoizedBinding?.unbind(context);
    this._status = MemoStatus.Unmouting;
  }

  disconnect(context: UpdateContext): void {
    this._memoizedBinding?.disconnect(context);
    this._status = MemoStatus.Idle;
  }

  commit(context: EffectContext): void {
    switch (this._status) {
      case MemoStatus.Mounting:
        if (this._memoizedBinding !== this._pendingBinding) {
          this._memoizedBinding?.commit(context);
        }
        this._pendingBinding.commit(context);
        this._memoizedBinding = this._pendingBinding;
        break;
      case MemoStatus.Mounting:
        this._memoizedBinding?.commit(context);
        this._memoizedBinding = null;
        break;
    }
    this._status = MemoStatus.Idle;
  }
}
