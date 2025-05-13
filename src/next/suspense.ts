import type {
  Binding,
  Directive,
  EffectContext,
  UpdateContext,
} from './coreTypes.js';
import type { Part } from './part.js';

export class SuspenseBinding<T> implements Binding<T> {
  private readonly _binding: Binding<T>;

  private _pendingValue: T | null = null;

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
    if (this._pendingValue === null) {
      context.enqueueBinding(this._binding);
    } else {
      this._binding.bind(this._pendingValue, context);
      this._pendingValue = null;
    }
  }

  bind(newValue: T, context: UpdateContext): void {
    context.enqueueBinding(this);
    this._pendingValue = newValue;
  }

  disconnect(context: UpdateContext): void {
    this._binding.disconnect(context);
  }

  commit(context: EffectContext): void {
    this._binding.commit(context);
  }

  rollback(context: EffectContext): void {
    this._binding.commit(context);
  }
}
