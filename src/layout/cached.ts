import { LRUMap } from '../collections/lru-map.js';
import type {
  Binding,
  DirectiveType,
  Layout,
  Part,
  Slot,
  UnwrapBindable,
  UpdateSession,
} from '../core.js';
import { LayoutModifier, toDirective } from '../directive.js';

export function Cached<TSource, TKey>(
  source: TSource,
  key: TKey,
  capacity: number,
): LayoutModifier<TSource> {
  return new LayoutModifier(source, new CachedLayout(key, capacity, null));
}

export class CachedLayout<TKey> implements Layout {
  private readonly _key: TKey;

  private readonly _capacity: number;

  private readonly _layout: Layout | null;

  constructor(key: TKey, capacity: number, layout: Layout | null) {
    this._key = key;
    this._capacity = capacity;
    this._layout = layout;
  }

  get name(): string {
    return CachedLayout.name;
  }

  get key(): TKey {
    return this._key;
  }

  get capacity(): number {
    return this._capacity;
  }

  get layout(): Layout | null {
    return this._layout;
  }

  compose(layout: Layout): Layout {
    return new CachedLayout(this._key, this._capacity, layout);
  }

  placeBinding<TSource>(
    binding: Binding<UnwrapBindable<TSource>>,
    defaultLayout: Layout,
  ): CachedSlot<TSource, TKey> {
    const layout = this._layout ?? defaultLayout;
    const slot = layout.placeBinding(binding, defaultLayout);
    return new CachedSlot(slot, this._key, this._capacity);
  }
}

export class CachedSlot<TSource, TKey> implements Slot<TSource> {
  private _pendingSlot: Slot<TSource>;

  private _memoizedSlot: Slot<TSource> | null = null;

  private _key: TKey;

  private readonly _cachedSlots: LRUMap<TKey, Slot<TSource>>;

  constructor(slot: Slot<TSource>, key: TKey, capacity: number) {
    this._pendingSlot = slot;
    this._key = key;
    this._cachedSlots = new LRUMap(capacity);
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

  attach(session: UpdateSession): void {
    this._pendingSlot.attach(session);
  }

  detach(session: UpdateSession): void {
    this._pendingSlot.detach(session);
  }

  reconcile(source: TSource, session: UpdateSession): boolean {
    const { layout } = toDirective(source);
    const key = (
      layout instanceof CachedLayout ? layout.key : undefined
    ) as TKey;
    const capacity =
      layout instanceof CachedLayout
        ? layout.capacity
        : this._cachedSlots.capacity;
    let dirty: boolean;

    if (this._cachedSlots.capacity !== capacity) {
      this._cachedSlots.resize(capacity);
    }

    if (Object.is(key, this._key)) {
      dirty = this._pendingSlot.reconcile(source, session);
    } else {
      this._pendingSlot.detach(session);
      this._cachedSlots.set(this._key, this._pendingSlot);

      const cachedSlot = this._cachedSlots.get(key);

      if (cachedSlot !== undefined) {
        this._pendingSlot = cachedSlot;
        dirty = cachedSlot.reconcile(source, session);
      } else {
        const { context } = session;
        const { type, value, layout, defaultLayout } = context.resolveDirective(
          source,
          this._pendingSlot.part,
        );
        const binding = type.resolveBinding(
          value,
          this._pendingSlot.part,
          context,
        );
        const innerLayout =
          layout instanceof CachedLayout
            ? (layout.layout ?? defaultLayout)
            : layout;

        this._pendingSlot = innerLayout.placeBinding(binding, defaultLayout);
        this._pendingSlot.attach(session);
        dirty = true;
      }
    }

    this._key = key;

    return dirty;
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
