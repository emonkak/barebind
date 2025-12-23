import { debugPart, undebugPart } from '../debug/part.js';
import { DirectiveError, LayoutSpecifier } from '../directive.js';
import {
  areDirectiveTypesEqual,
  type Binding,
  type DirectiveType,
  type Layout,
  type Part,
  type Slot,
  type UnwrapBindable,
  type UpdateSession,
} from '../internal.js';

export function Keyed<TKey, TValue>(
  key: TKey,
  value: TValue,
): LayoutSpecifier<TValue> {
  return new LayoutSpecifier(new KeyedLayout(key), value);
}

export class KeyedLayout<TKey> implements Layout {
  private readonly _key: TKey;

  get name(): string {
    return this.constructor.name;
  }

  get key(): TKey {
    return this._key;
  }

  constructor(key: TKey) {
    this._key = key;
  }

  resolveSlot<TValue>(
    binding: Binding<UnwrapBindable<TValue>>,
  ): KeyedSlot<TKey, TValue> {
    return new KeyedSlot(this._key, binding);
  }
}

export class KeyedSlot<TKey, TValue> implements Slot<TValue> {
  private _key: TKey;

  private _pendingBinding: Binding<UnwrapBindable<TValue>>;

  private _memoizedBinding: Binding<UnwrapBindable<TValue>> | null = null;

  private _dirty = false;

  constructor(key: TKey, binding: Binding<UnwrapBindable<TValue>>) {
    this._key = key;
    this._pendingBinding = binding;
  }

  get type(): DirectiveType<UnwrapBindable<TValue>> {
    return this._pendingBinding.type;
  }

  get value(): UnwrapBindable<TValue> {
    return this._pendingBinding.value;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  reconcile(value: TValue, session: UpdateSession): boolean {
    const { context } = session;
    const directive = context.resolveDirective(
      value,
      this._pendingBinding.part,
    );
    const key = (
      directive.layout instanceof KeyedLayout ? directive.layout.key : undefined
    ) as TKey;

    if (Object.is(key, this._key)) {
      if (!areDirectiveTypesEqual(directive.type, this._pendingBinding.type)) {
        throw new DirectiveError(
          directive.type,
          directive.value,
          this._pendingBinding.part,
          `The directive type must be ${this._pendingBinding.type.name} in this slot, but got ${directive.type.name}.`,
        );
      }

      if (this._dirty || this._pendingBinding.shouldUpdate(directive.value)) {
        this._pendingBinding.value = directive.value;
        this._pendingBinding.attach(session);
        this._dirty = true;
      }
    } else {
      this._pendingBinding.detach(session);
      this._pendingBinding = directive.type.resolveBinding(
        directive.value,
        this._pendingBinding.part,
        context,
      );
      this._pendingBinding.attach(session);
      this._dirty = true;
    }

    this._key = key;

    return this._dirty;
  }

  attach(session: UpdateSession): void {
    this._pendingBinding.attach(session);
    this._dirty = true;
  }

  detach(session: UpdateSession): void {
    this._pendingBinding.detach(session);
    this._dirty = true;
  }

  commit(): void {
    if (!this._dirty) {
      return;
    }

    const newBinding = this._pendingBinding;
    const oldBinding = this._memoizedBinding;

    if (newBinding !== oldBinding) {
      if (oldBinding !== null) {
        oldBinding.rollback();

        DEBUG: {
          undebugPart(oldBinding.part, oldBinding.type);
        }
      }
    }

    DEBUG: {
      debugPart(newBinding.part, newBinding.type, newBinding.value);
    }

    newBinding.commit();

    this._memoizedBinding = newBinding;
    this._dirty = false;
  }

  rollback(): void {
    if (!this._dirty) {
      return;
    }

    const binding = this._memoizedBinding;

    if (binding !== null) {
      binding.rollback();

      DEBUG: {
        undebugPart(binding.part, binding.type);
      }
    }

    this._memoizedBinding = null;
    this._dirty = false;
  }
}
