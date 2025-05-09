import {
  type Binding,
  type Directive,
  type DirectiveElement,
  type DirectiveProtocol,
  type EffectProtocol,
  type UpdateProtocol,
  createDirectiveElement,
  resolveBindingTag,
} from './coreTypes.js';
import type { ContextualKey } from './hook.js';
import type { Part } from './part.js';

export interface ContextProviderValue<TValue, TChild> {
  value: TValue;
  child: TChild;
}

export function createContext<TValue, TChild = unknown>(
  defaultValue: TValue,
): ContextProvider<TValue, TChild> {
  return new ContextProvider(defaultValue);
}

export class ContextProvider<TValue, TChild>
  implements
    ContextualKey<TValue>,
    Directive<ContextProviderValue<TValue, TChild>>
{
  constructor(public readonly defaultValue?: TValue) {}

  provide(
    value: ContextProviderValue<TValue, TChild>,
  ): DirectiveElement<ContextProviderValue<TValue, TChild>> {
    return createDirectiveElement(this, value);
  }

  [resolveBindingTag](
    value: ContextProviderValue<TValue, TChild>,
    part: Part,
    context: DirectiveProtocol,
  ): Binding<ContextProviderValue<TValue, TChild>> {
    const binding = context.resolveBinding(value.child, part);
    return new ContextProviderBinding(this, value, binding);
  }
}

export class ContextProviderBinding<TValue, TChild>
  implements Binding<ContextProviderValue<TValue, TChild>>
{
  private _key: ContextProvider<TValue, TChild>;

  private _value: ContextProviderValue<TValue, TChild>;

  private _binding: Binding<TChild>;

  constructor(
    key: ContextProvider<TValue, TChild>,
    value: ContextProviderValue<TValue, TChild>,
    binding: Binding<TChild>,
  ) {
    this._key = key;
    this._value = value;
    this._binding = binding;
  }

  get directive(): ContextProvider<TValue, TChild> {
    return this._key;
  }

  get value(): ContextProviderValue<TValue, TChild> {
    return this._value;
  }

  get part(): Part {
    return this._binding.part;
  }

  connect(context: UpdateProtocol): void {
    const subContext = context.enterContextualScope(
      this._key,
      this._value.value,
    );
    this._binding.connect(subContext);
  }

  bind(
    newValue: ContextProviderValue<TValue, TChild>,
    context: UpdateProtocol,
  ): void {
    const subContext = context.enterContextualScope(this._key, newValue.value);
    this._binding.bind(newValue.child, subContext);
  }

  unbind(context: UpdateProtocol): void {
    const subContext = context.enterContextualScope(
      this._key,
      this._value.value,
    );
    this._binding.unbind(subContext);
  }

  disconnect(context: UpdateProtocol): void {
    const subContext = context.enterContextualScope(
      this._key,
      this._value.value,
    );
    this._binding.disconnect(subContext);
  }

  commit(context: EffectProtocol): void {
    this._binding.commit(context);
  }
}
