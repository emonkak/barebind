import {
  type Bindable,
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type EffectContext,
  type UpdateContext,
  createDirectiveElement,
  resolveBindingTag,
} from './coreTypes.js';
import type { Part } from './part.js';

export function memo<T>(value: Bindable<T>): DirectiveElement<Bindable<T>> {
  return createDirectiveElement(Memo as Directive<Bindable<T>>, value);
}

export const Memo: Directive<Bindable<unknown>> = {
  [resolveBindingTag](
    value: unknown,
    part: Part,
    context: DirectiveContext,
  ): MemoBinding<unknown> {
    const binding = context.resolveBinding(value, part);
    return new MemoBinding(binding);
  },
};

export class MemoBinding<T> implements Binding<Bindable<T>> {
  private _binding: Binding<T>;

  private readonly _memoizedBindings: Map<Directive<T>, Binding<T>> = new Map();

  constructor(binding: Binding<T>) {
    this._binding = binding;
  }

  get directive(): Directive<Bindable<T>> {
    return Memo as Directive<Bindable<T>>;
  }

  get value(): Bindable<T> {
    return this._binding.value;
  }

  get part(): Part {
    return this._binding.part;
  }

  connect(context: UpdateContext): void {
    this._binding.connect(context);
  }

  bind(value: Bindable<T>, context: UpdateContext): void {
    const oldBinding = this._binding;
    const newElement = context.resolveDirectiveElement(
      value,
      this._binding.part,
    );
    if (oldBinding.directive !== newElement.directive) {
      const memoizedBinding = this._memoizedBindings.get(newElement.directive);
      if (memoizedBinding !== undefined) {
        memoizedBinding.bind(newElement.value, context);
        this._binding = memoizedBinding;
      } else {
        this._binding = newElement.directive[resolveBindingTag](
          newElement.value,
          oldBinding.part,
          context,
        );
        this._binding.connect(context);
      }
      this._memoizedBindings.set(oldBinding.directive, oldBinding);
    } else {
      this._binding.bind(newElement.value, context);
    }
  }

  unbind(context: UpdateContext): void {
    this._binding.unbind(context);
  }

  disconnect(context: UpdateContext): void {
    this._binding.disconnect(context);
  }

  commit(context: EffectContext): void {
    this._binding.commit(context);
  }
}
