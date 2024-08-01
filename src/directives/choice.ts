import { resolveBinding } from '../binding.js';
import { ensureDirective } from '../error.js';
import {
  type Binding,
  type Directive,
  type Part,
  type UpdateContext,
  directiveTag,
  nameOf,
  nameTag,
} from '../types.js';

export function choice<TKey, TValue>(
  key: TKey,
  factory: (key: TKey) => TValue,
): Choice<TKey, TValue> {
  return new Choice(key, factory);
}

export class Choice<TKey, TValue> implements Directive {
  private readonly _key: TKey;

  private readonly _factory: (key: TKey) => TValue;

  constructor(key: TKey, factory: (key: TKey) => TValue) {
    this._key = key;
    this._factory = factory;
  }

  get key(): TKey {
    return this._key;
  }

  get factory(): (key: TKey) => TValue {
    return this._factory;
  }

  get [nameTag](): string {
    return (
      'Choice(' +
      nameOf(this._key) +
      ', ' +
      nameOf(this._factory(this._key)) +
      ')'
    );
  }

  [directiveTag](
    part: Part,
    context: UpdateContext<unknown>,
  ): ChoiceBinding<TKey, TValue> {
    return new ChoiceBinding(this, part, context);
  }
}

export class ChoiceBinding<TKey, TValue>
  implements Binding<Choice<TKey, TValue>>
{
  private _value: Choice<TKey, TValue>;

  private _binding: Binding<TValue>;

  private _cachedBindings: Map<TKey, Binding<TValue>> = new Map();

  constructor(
    value: Choice<TKey, TValue>,
    part: Part,
    context: UpdateContext<unknown>,
  ) {
    const { key, factory } = value;
    const selection = factory(key);
    this._value = value;
    this._binding = resolveBinding(selection, part, context);
  }

  get value(): Choice<TKey, TValue> {
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

  bind(newValue: Choice<TKey, TValue>, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureDirective(Choice, newValue, this._binding.part);
    }

    const oldValue = this._value;
    const { key, factory } = newValue;
    const selection = factory(key);

    if (Object.is(oldValue.key, newValue.key)) {
      this._binding.bind(selection, context);
    } else {
      this._binding.unbind(context);

      // Remenber the old binding for future updates.
      this._cachedBindings.set(oldValue.key, this._binding);

      const cachedBinding = this._cachedBindings.get(key);
      if (cachedBinding !== undefined) {
        cachedBinding.bind(selection, context);
        this._binding = cachedBinding;
      } else {
        const binding = resolveBinding(selection, this._binding.part, context);
        binding.connect(context);
        this._binding = binding;
      }
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
