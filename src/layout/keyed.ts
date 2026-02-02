import { debugPart, undebugPart } from '../debug/part.js';
import { DirectiveError } from '../directive.js';
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
import { LayoutSpecifier, SlotStatus } from './layout.js';

export function Keyed<TSource, TKey>(
  source: TSource,
  key: TKey,
): LayoutSpecifier<TSource> {
  return new LayoutSpecifier(source, new KeyedLayout(key));
}

export class KeyedLayout<TKey> implements Layout {
  private readonly _key: TKey;

  constructor(key: TKey) {
    this._key = key;
  }

  get name(): string {
    return KeyedLayout.name;
  }

  get key(): TKey {
    return this._key;
  }

  placeBinding<TSource>(
    binding: Binding<UnwrapBindable<TSource>>,
  ): KeyedSlot<TSource, TKey> {
    return new KeyedSlot(binding, this._key);
  }
}

export class KeyedSlot<TSource, TKey> implements Slot<TSource> {
  private _pendingBinding: Binding<UnwrapBindable<TSource>>;

  private _memoizedBinding: Binding<UnwrapBindable<TSource>> | null = null;

  private _key: TKey;

  private _status: SlotStatus = SlotStatus.Idle;

  constructor(binding: Binding<UnwrapBindable<TSource>>, key: TKey) {
    this._pendingBinding = binding;
    this._key = key;
  }

  get type(): DirectiveType<UnwrapBindable<TSource>> {
    return this._pendingBinding.type;
  }

  get value(): UnwrapBindable<TSource> {
    return this._pendingBinding.value;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  reconcile(source: TSource, session: UpdateSession): boolean {
    const { context } = session;
    const { type, value, layout } = context.resolveDirective(
      source,
      this._pendingBinding.part,
    );
    const key = (
      layout instanceof KeyedLayout ? layout.key : undefined
    ) as TKey;

    if (Object.is(key, this._key)) {
      if (!areDirectiveTypesEqual(type, this._pendingBinding.type)) {
        throw new DirectiveError(
          type,
          value,
          this._pendingBinding.part,
          `The directive type must be ${this._pendingBinding.type.name} in the slot, but got ${type.name}.`,
        );
      }

      if (
        this._status !== SlotStatus.Idle ||
        this._pendingBinding.shouldUpdate(value)
      ) {
        this._pendingBinding.value = value;
        this._pendingBinding.attach(session);
        this._status = SlotStatus.Attached;
      }
    } else {
      this._pendingBinding.detach(session);
      this._pendingBinding = type.resolveBinding(
        value,
        this._pendingBinding.part,
        context,
      );
      this._pendingBinding.attach(session);
      this._status = SlotStatus.Attached;
    }

    this._key = key;

    return this._status === SlotStatus.Attached;
  }

  attach(session: UpdateSession): void {
    this._pendingBinding.attach(session);
    this._status = SlotStatus.Attached;
  }

  detach(session: UpdateSession): void {
    this._pendingBinding.detach(session);
    this._status = SlotStatus.Detached;
  }

  commit(): void {
    if (this._status !== SlotStatus.Attached) {
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
    this._status = SlotStatus.Idle;
  }

  rollback(): void {
    if (this._status !== SlotStatus.Detached) {
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
    this._status = SlotStatus.Idle;
  }
}
