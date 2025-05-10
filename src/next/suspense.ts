import type {
  Binding,
  Directive,
  EffectContext,
  UpdateContext,
} from './coreTypes.js';
import type { Part } from './part.js';

const noValue = Symbol('noValue');

export class SuspenseBinding<T> implements Binding<T> {
  private readonly _binding: Binding<T>;

  private _pendingValue: T | typeof noValue = noValue;

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

  connect(context: UpdateContext): void {
    if (this._pendingValue === noValue) {
      context.enqueueBinding(this._binding);
    } else {
      this._binding.bind(this._pendingValue, context);
      this._pendingValue = noValue;
    }
  }

  bind(newValue: T, context: UpdateContext): void {
    context.enqueueBinding(this);
    this._pendingValue = newValue;
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
