import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type Part,
  type UpdateContext,
  directiveTag,
  nameOf,
  nameTag,
} from '../baseTypes.js';
import { resolveBinding } from '../binding.js';
import { ensureDirective } from '../error.js';

export function keyed<TKey, TValue>(
  key: TKey,
  value: TValue,
): Keyed<TKey, TValue> {
  return new Keyed(key, value);
}

export class Keyed<TKey, TValue> implements Directive<Keyed<TKey, TValue>> {
  private readonly _key: TKey;

  private readonly _value: TValue;

  constructor(key: TKey, value: TValue) {
    this._key = key;
    this._value = value;
  }

  get key(): TKey {
    return this._key;
  }

  get value(): TValue {
    return this._value;
  }

  get [nameTag](): string {
    return 'Keyed(' + nameOf(this._key) + ', ' + nameOf(this._value) + ')';
  }

  [directiveTag](
    part: Part,
    context: DirectiveContext,
  ): KeyedBinding<TKey, TValue> {
    return new KeyedBinding(this, part, context);
  }
}

export class KeyedBinding<TKey, TValue>
  implements Binding<Keyed<TKey, TValue>>
{
  private _value: Keyed<TKey, TValue>;

  private _binding: Binding<TValue>;

  constructor(
    value: Keyed<TKey, TValue>,
    part: Part,
    context: DirectiveContext,
  ) {
    this._value = value;
    this._binding = resolveBinding(value.value, part, context);
  }

  get value(): Keyed<TKey, TValue> {
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

  connect(context: UpdateContext<unknown>): void {
    this._binding.connect(context);
  }

  bind(newValue: Keyed<TKey, TValue>, context: UpdateContext<unknown>): void {
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

  unbind(context: UpdateContext<unknown>): void {
    this._binding.unbind(context);
  }

  disconnect(): void {
    this._binding.disconnect();
  }
}
