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

export function cached<TKey, TValue>(
  key: TKey,
  value: TValue,
): Cached<TKey, TValue> {
  return new Cached(key, value);
}

export class Cached<TKey, TValue> implements Directive<Cached<TKey, TValue>> {
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
    return 'Cached(' + nameOf(this._key) + ', ' + nameOf(this._value) + ')';
  }

  [directiveTag](
    part: Part,
    context: DirectiveContext,
  ): CachedBinding<TKey, TValue> {
    return new CachedBinding(this, part, context);
  }
}

export class CachedBinding<TKey, TValue>
  implements Binding<Cached<TKey, TValue>>
{
  private _value: Cached<TKey, TValue>;

  private _binding: Binding<TValue>;

  private _cachedBindings: Map<TKey, Binding<TValue>> = new Map();

  constructor(
    value: Cached<TKey, TValue>,
    part: Part,
    context: DirectiveContext,
  ) {
    this._value = value;
    this._binding = resolveBinding(value.value, part, context);
  }

  get value(): Cached<TKey, TValue> {
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

  bind(newValue: Cached<TKey, TValue>, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureDirective(Cached, newValue, this._binding.part);
    }

    const oldValue = this._value;

    if (Object.is(oldValue.key, newValue.key)) {
      this._binding.bind(newValue.value, context);
    } else {
      this._binding.unbind(context);

      // Remenber the old binding for future updates.
      this._cachedBindings.set(oldValue.key, this._binding);

      const cachedBinding = this._cachedBindings.get(newValue.key);
      if (cachedBinding !== undefined) {
        cachedBinding.bind(newValue.value, context);
        this._binding = cachedBinding;
      } else {
        const newBinding = resolveBinding(
          newValue.value,
          this._binding.part,
          context,
        );
        newBinding.connect(context);
        this._binding = newBinding;
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
