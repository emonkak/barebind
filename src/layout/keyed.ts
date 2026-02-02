import {
  type Binding,
  type DirectiveType,
  type Layout,
  type Part,
  type Slot,
  toDirective,
  type UnwrapBindable,
  type UpdateSession,
} from '../internal.js';
import { LayoutSpecifier } from './layout.js';
import { StrictLayout } from './strict.js';

export function Keyed<TSource, TKey>(
  source: TSource,
  key: TKey,
  layout: Layout = StrictLayout,
): LayoutSpecifier<TSource> {
  return new LayoutSpecifier(source, new KeyedLayout(key, layout));
}

export class KeyedLayout<TKey> implements Layout {
  private readonly _key: TKey;

  private readonly _layout: Layout;

  constructor(key: TKey, layout: Layout) {
    this._key = key;
    this._layout = layout;
  }

  get name(): string {
    return KeyedLayout.name;
  }

  get key(): TKey {
    return this._key;
  }

  get layout(): Layout {
    return this._layout;
  }

  placeBinding<TSource>(
    binding: Binding<UnwrapBindable<TSource>>,
  ): KeyedSlot<TSource, TKey> {
    const slot = this._layout.placeBinding(binding);
    return new KeyedSlot(slot, this._key);
  }
}

export class KeyedSlot<TSource, TKey> implements Slot<TSource> {
  private _pendingSlot: Slot<TSource>;

  private _memoizedSlot: Slot<TSource> | null = null;

  private _key: TKey;

  constructor(slot: Slot<TSource>, key: TKey) {
    this._pendingSlot = slot;
    this._key = key;
  }

  get type(): DirectiveType<UnwrapBindable<TSource>> {
    return this._pendingSlot.type;
  }

  get value(): UnwrapBindable<TSource> {
    return this._pendingSlot.value;
  }

  get part(): Part {
    return this._pendingSlot.part;
  }

  reconcile(source: TSource, session: UpdateSession): boolean {
    const { layout } = toDirective(source);
    const key = (
      layout instanceof KeyedLayout ? layout.key : undefined
    ) as TKey;
    let dirty: boolean;

    if (Object.is(key, this._key)) {
      dirty = this._pendingSlot.reconcile(source, session);
    } else {
      this._pendingSlot.detach(session);
      const { context } = session;
      const { type, value, layout } = context.resolveDirective(
        source,
        this._pendingSlot.part,
      );
      const binding = type.resolveBinding(
        value,
        this._pendingSlot.part,
        context,
      );
      const innerLayout =
        layout instanceof KeyedLayout ? layout.layout : layout;
      this._pendingSlot = innerLayout.placeBinding(binding);
      this._pendingSlot.attach(session);
      dirty = true;
    }

    this._key = key;

    return dirty;
  }

  attach(session: UpdateSession): void {
    this._pendingSlot.attach(session);
  }

  detach(session: UpdateSession): void {
    this._pendingSlot.detach(session);
  }

  commit(): void {
    const newSlot = this._pendingSlot;
    const oldSlot = this._memoizedSlot;

    if (newSlot !== oldSlot) {
      oldSlot?.rollback();
    }

    newSlot.commit();

    this._memoizedSlot = newSlot;
  }

  rollback(): void {
    this._memoizedSlot?.rollback();
    this._memoizedSlot = null;
  }
}
