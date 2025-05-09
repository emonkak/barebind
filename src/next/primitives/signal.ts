import type { Subscription } from '../../directives.js';
import {
  type Binding,
  type Directive,
  type DirectiveElement,
  type DirectiveProtocol,
  type EffectProtocol,
  type UpdateProtocol,
  resolveBindingTag,
} from '../coreTypes.js';
import { inspectPart, markUsedValue, nameOf } from '../debug.js';
import type { ElementPart, Part } from '../part.js';
import { Signal } from '../signal.js';
import type { Primitive } from './primitive.js';

export function signal<T>(value: Signal<T>): DirectiveElement<Signal<T>> {
  return {
    directive: SignalPrimitive as Directive<Signal<T>>,
    value,
  };
}

export const SignalPrimitive: Primitive<Signal<unknown>> = {
  ensureValue(
    value: unknown,
    part: ElementPart,
  ): asserts value is Signal<unknown> {
    if (!(value instanceof Signal)) {
      throw new Error(
        `The value of spread primitive must be Signal, but got "${nameOf(value)}".\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  [resolveBindingTag](
    value: Signal<unknown>,
    part: Part,
    context: DirectiveProtocol,
  ): SignalBinding<unknown> {
    const binding = context.prepareBinding(value.value, part);
    return new SignalBinding(binding, value);
  },
};

export class SignalBinding<T> implements Binding<Signal<T>> {
  private _binding: Binding<T>;

  private _value: Signal<T>;

  private _subscription: Subscription | null = null;

  constructor(binding: Binding<T>, value: Signal<T>) {
    this._binding = binding;
    this._value = value;
  }

  get directive(): Primitive<Signal<T>> {
    return SignalPrimitive as Primitive<Signal<T>>;
  }

  get value(): Signal<T> {
    return this._value;
  }

  get part(): Part {
    return this._binding.part;
  }

  connect(context: UpdateProtocol): void {
    this._binding.connect(context);
    this._subscription ??= this._value.subscribe(() => {
      context.scheduleUpdate(this._binding);
    });
  }

  bind(value: Signal<T>, context: UpdateProtocol): void {
    if (this._value !== value) {
      this._subscription?.();
      this._subscription ??= value.subscribe(() => {
        context.scheduleUpdate(this._binding, { priority: 'background' });
      });
      this._value = value;
    }
  }

  unbind(context: UpdateProtocol): void {
    this._binding.unbind(context);
    this._subscription?.();
    this._subscription = null;
  }

  disconnect(context: UpdateProtocol): void {
    this._binding.disconnect(context);
    this._subscription?.();
    this._subscription = null;
  }

  commit(context: EffectProtocol): void {
    this._binding.commit(context);
  }
}
