import { resolveBinding } from '../binding.js';
import { ensureDirective } from '../error.js';
import {
  type Binding,
  type Directive,
  type Part,
  type Updater,
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
    updater: Updater<unknown>,
  ): ChoiceBinding<TKey, TValue> {
    return new ChoiceBinding(this, part, updater);
  }
}

export class ChoiceBinding<TKey, TValue>
  implements Binding<Choice<TKey, TValue>>
{
  private _directive: Choice<TKey, TValue>;

  private _binding: Binding<TValue>;

  private _cachedBindings: Map<TKey, Binding<TValue>> = new Map();

  constructor(
    directive: Choice<TKey, TValue>,
    part: Part,
    updater: Updater<unknown>,
  ) {
    const { key, factory } = directive;
    const value = factory(key);
    this._directive = directive;
    this._binding = resolveBinding(value, part, updater);
  }

  get value(): Choice<TKey, TValue> {
    return this._directive;
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

  connect(updater: Updater<unknown>): void {
    this._binding.connect(updater);
  }

  bind(newValue: Choice<TKey, TValue>, updater: Updater<unknown>): void {
    DEBUG: {
      ensureDirective(Choice, newValue, this._binding.part);
    }

    const oldValue = this._directive;
    const { key, factory } = newValue;
    const value = factory(key);

    if (Object.is(oldValue.key, newValue.key)) {
      this._binding.bind(value, updater);
    } else {
      this._binding.unbind(updater);

      // Remenber the old binding for future updates.
      this._cachedBindings.set(oldValue.key, this._binding);

      const cachedBinding = this._cachedBindings.get(key);
      if (cachedBinding !== undefined) {
        cachedBinding.bind(value, updater);
        this._binding = cachedBinding;
      } else {
        const binding = resolveBinding(value, this._binding.part, updater);
        binding.connect(updater);
        this._binding = binding;
      }
    }

    this._directive = newValue;
  }

  unbind(updater: Updater<unknown>): void {
    this._binding.unbind(updater);
  }

  disconnect(): void {
    this._binding.disconnect();
  }
}
