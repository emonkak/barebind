import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type Part,
  type UpdateContext,
  directiveTag,
  nameOf,
  resolveBinding,
} from '../baseTypes.js';
import { ensureDirective } from '../error.js';

export function keyed<TValue, TKey>(
  value: TValue,
  key: TKey,
): Keyed<TValue, TKey> {
  return new Keyed(value, key);
}

export class Keyed<TValue, TKey> implements Directive<Keyed<TValue, TKey>> {
  private readonly _value: TValue;

  private readonly _key: TKey;

  constructor(value: TValue, key: TKey) {
    this._value = value;
    this._key = key;
  }

  get value(): TValue {
    return this._value;
  }

  get key(): TKey {
    return this._key;
  }

  get [Symbol.toStringTag](): string {
    return `Keyed(${nameOf(this._value)}, ${nameOf(this._key)})`;
  }

  [directiveTag](
    part: Part,
    context: DirectiveContext,
  ): KeyedBinding<TValue, TKey> {
    return new KeyedBinding(this, part, context);
  }
}

export class KeyedBinding<TValue, TKey>
  implements Binding<Keyed<TValue, TKey>>
{
  private _value: Keyed<TValue, TKey>;

  private _binding: Binding<TValue>;

  constructor(
    value: Keyed<TValue, TKey>,
    part: Part,
    context: DirectiveContext,
  ) {
    this._value = value;
    this._binding = resolveBinding(value.value, part, context);
  }

  get value(): Keyed<TValue, TKey> {
    return this._value;
  }

  get part(): Part {
    return this._binding.part;
  }

  get startNode(): ChildNode {
    return this._binding.startNode;
  }

  get endNode(): ChildNode {
    return this._binding.endNode;
  }

  get binding(): Binding<TValue> {
    return this._binding;
  }

  connect(context: UpdateContext): void {
    this._binding.connect(context);
  }

  bind(newValue: Keyed<TValue, TKey>, context: UpdateContext): void {
    DEBUG: {
      ensureDirective(Keyed, newValue, this._binding.part);
    }

    const oldValue = this._value;

    if (Object.is(oldValue.key, newValue.key)) {
      this._binding.bind(newValue.value, context);
    } else {
      const newBinding = resolveBinding(
        newValue.value,
        this._binding.part,
        context,
      );
      this._binding.unbind(context);
      newBinding.connect(context);
      this._binding = newBinding;
    }

    this._value = newValue;
  }

  unbind(context: UpdateContext): void {
    this._binding.unbind(context);
  }

  disconnect(context: UpdateContext): void {
    this._binding.disconnect(context);
  }
}
