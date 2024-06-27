import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
  resolveBinding,
} from '../binding.js';
import {
  type ChildNodePart,
  type Effect,
  type Part,
  PartType,
  type Updater,
} from '../types.js';

type Selector<TItem, TResult> = (item: TItem, index: number) => TResult;

export function keyedList<TItem, TKey, TValue>(
  items: TItem[],
  keySelector: Selector<TItem, TKey>,
  valueSelector: Selector<TItem, TValue>,
): ListDirective<TItem, TKey, TValue> {
  return new ListDirective(items, keySelector, valueSelector);
}

export function indexedList<TItem, TValue>(
  items: TItem[],
  valueSelector: Selector<TItem, TValue>,
): ListDirective<TItem, number, TValue> {
  return new ListDirective(items, indexSelector, valueSelector);
}

export class ListDirective<TItem, TKey, TValue> implements Directive {
  private readonly _items: TItem[];

  private readonly _keySelector: Selector<TItem, TKey>;

  private readonly _valueSelector: Selector<TItem, TValue>;

  constructor(
    items: TItem[],
    keySelector: Selector<TItem, TKey>,
    valueSelector: Selector<TItem, TValue>,
  ) {
    this._items = items;
    this._keySelector = keySelector;
    this._valueSelector = valueSelector;
  }

  get items(): TItem[] {
    return this._items;
  }

  get keySelector(): Selector<TItem, TKey> {
    return this._keySelector;
  }

  get valueSelector(): Selector<TItem, TValue> {
    return this._valueSelector;
  }

  [directiveTag](
    part: Part,
    _updater: Updater,
  ): ListBinding<TItem, TKey, TValue> {
    if (part.type !== PartType.ChildNode) {
      throw new Error('ListDirective must be used in ChildNodePart.');
    }
    return new ListBinding(this, part);
  }
}

export class ListBinding<TItem, TKey, TValue>
  implements Binding<ListDirective<TItem, TKey, TValue>>, Effect
{
  private _directive: ListDirective<TItem, TKey, TValue>;

  private readonly _part: ChildNodePart;

  private _pendingBindings: Binding<TValue>[] = [];

  private _memoizedBindings: Binding<TValue>[] = [];

  private _memoizedKeys: TKey[] = [];

  private _dirty = false;

  constructor(
    directive: ListDirective<TItem, TKey, TValue>,
    part: ChildNodePart,
  ) {
    this._directive = directive;
    this._part = part;
  }

  get value(): ListDirective<TItem, TKey, TValue> {
    return this._directive;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._memoizedBindings[0]?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get bindings(): Binding<TValue>[] {
    return this._pendingBindings;
  }

  connect(updater: Updater): void {
    this._updateItems(updater);
  }

  bind(newValue: ListDirective<TItem, TKey, TValue>, updater: Updater): void {
    DEBUG: {
      ensureDirective(ListDirective, newValue);
    }
    const oldValue = this._directive;
    if (oldValue.items !== newValue.items) {
      this._directive = newValue;
      this._updateItems(updater);
    }
  }

  unbind(updater: Updater): void {
    const { keySelector, valueSelector } = this._directive;
    this._directive = new ListDirective([], keySelector, valueSelector);
    this._clearItems(updater);
  }

  disconnect(): void {
    for (let i = 0, l = this._pendingBindings.length; i < l; i++) {
      this._pendingBindings[i]!.disconnect();
    }
  }

  commit(): void {
    this._memoizedBindings = this._pendingBindings;
    this._dirty = false;
  }

  private _clearItems(updater: Updater): void {
    for (let i = 0, l = this._pendingBindings.length; i < l; i++) {
      removeItem(this._pendingBindings[i]!, updater);
    }
    this._pendingBindings = [];
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  private _reconcileItems(updater: Updater): void {
    const { items, keySelector, valueSelector } = this._directive;
    const oldBindings: (Binding<TValue> | null)[] = this._pendingBindings;
    const newBindings = new Array<Binding<TValue>>(items.length);
    const oldKeys = this._memoizedKeys;
    const newKeys = items.map(keySelector);
    const newValues = items.map(valueSelector);

    // Head and tail pointers to old bindings and new bindings.
    let oldHead = 0;
    let newHead = 0;
    let oldTail = oldBindings.length - 1;
    let newTail = newBindings.length - 1;

    let oldKeyToIndexMap: Map<TKey, number> | null = null;
    let newKeyToIndexMap: Map<TKey, number> | null = null;

    while (oldHead <= oldTail && newHead <= newTail) {
      if (oldBindings[oldHead] === null) {
        // `null` means old binding at head has already been used below; skip
        oldHead++;
      } else if (oldBindings[oldTail] === null) {
        // `null` means old binding at tail has already been used below; skip
        oldTail--;
      } else if (oldKeys[oldHead] === newKeys[newHead]) {
        // Old head matches new head; update in place
        const binding = (newBindings[newHead] = oldBindings[oldHead]!);
        binding.bind(newValues[newHead]!, updater);
        oldHead++;
        newHead++;
      } else if (oldKeys[oldTail] === newKeys[newTail]) {
        // Old tail matches new tail; update in place
        const binding = (newBindings[newTail] = oldBindings[oldTail]!);
        binding.bind(newValues[newTail]!, updater);
        oldTail--;
        newTail--;
      } else if (oldKeys[oldHead] === newKeys[newTail]) {
        // Old tail matches new head; update and move to new head.
        const binding = (newBindings[newTail] = oldBindings[oldHead]!);
        binding.bind(newValues[newTail]!, updater);
        moveItem(
          binding,
          newBindings[newTail + 1] ?? null,
          this._part,
          updater,
        );
        oldHead++;
        newTail--;
      } else if (oldKeys[oldTail] === newKeys[newHead]) {
        // Old tail matches new head; update and move to new head.
        const binding = (newBindings[newHead] = oldBindings[oldTail]!);
        binding.bind(newValues[newHead]!, updater);
        moveItem(binding, oldBindings[oldHead]!, this._part, updater);
        oldTail--;
        newHead++;
      } else {
        if (newKeyToIndexMap === null) {
          // Lazily generate key-to-index maps, used for removals and moves
          // below.
          newKeyToIndexMap = generateIndexMap(newKeys, newHead, newTail);
          oldKeyToIndexMap = generateIndexMap(oldKeys, oldHead, oldTail);
        }
        if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
          // Old head is no longer in new list; remove
          removeItem(oldBindings[oldHead]!, updater);
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          // Old tail is no longer in new list; remove
          removeItem(oldBindings[oldTail]!, updater);
          oldTail--;
        } else {
          // Any mismatches at this point are due to additions or moves; see if
          // we have an old binding we can reuse and move into place.
          const oldIndex = oldKeyToIndexMap!.get(newKeys[newHead]!);
          if (oldIndex !== undefined && oldBindings[oldIndex] !== null) {
            // Reuse the old binding.
            const binding = (newBindings[newHead] = oldBindings[oldIndex]!);
            binding.bind(newValues[newHead]!, updater);
            moveItem(binding, oldBindings[oldHead]!, this._part, updater);
            // This marks the old binding as having been used, so that it will
            // be skipped in the first two checks above.
            oldBindings[oldIndex] = null;
          } else {
            // No old binding for this value; create a new one and insert it.
            newBindings[newHead] = insertItem(
              newKeys[newHead]!,
              newValues[newHead]!,
              oldBindings[oldHead]!,
              this._part,
              updater,
            );
          }
          newHead++;
        }
      }
    }

    // Add bindings for any remaining new values.
    while (newHead <= newTail) {
      // For all remaining additions, we insert before last new tail, since old
      // pointers are no longer valid.
      newBindings[newHead] = insertItem(
        newKeys[newHead]!,
        newValues[newHead]!,
        newBindings[newTail + 1] ?? null,
        this._part,
        updater,
      );
      newHead++;
    }

    // Remove any remaining unused old bindings.
    while (oldHead <= oldTail) {
      const oldBinding = oldBindings[oldHead]!;
      if (oldBinding !== null) {
        removeItem(oldBinding, updater);
      }
      oldHead++;
    }

    this._pendingBindings = newBindings;
    this._memoizedKeys = newKeys;
  }

  private _replaceItems(updater: Updater): void {
    const { items, keySelector, valueSelector } = this._directive;
    const oldBindings = this._pendingBindings;
    const newBindings = new Array<Binding<TValue>>(items.length);
    const newKeys = new Array<TKey>(items.length);

    for (
      let i = 0, l = Math.min(oldBindings.length, items.length);
      i < l;
      i++
    ) {
      const item = items[i]!;
      const key = keySelector(item, i);
      const value = valueSelector(item, i);
      const binding = this._pendingBindings[i]!;
      binding.bind(value, updater);
      newKeys[i] = key;
      newBindings[i] = binding;
    }

    for (let i = oldBindings.length, l = items.length; i < l; i++) {
      const item = items[i]!;
      const key = keySelector(item, i);
      const value = valueSelector(item, i);
      newKeys[i] = key;
      newBindings[i] = insertItem(key, value, null, this._part, updater);
    }

    for (let i = items.length, l = oldBindings.length; i < l; i++) {
      removeItem(oldBindings[i]!, updater);
    }

    this._pendingBindings = newBindings;
    this._memoizedKeys = newKeys;
  }

  private _updateItems(updater: Updater): void {
    if (
      this._directive.keySelector === indexSelector ||
      this._pendingBindings.length === 0
    ) {
      // Update items based on indexes. That is a fastpass of _reconcileItems().
      this._replaceItems(updater);
    } else {
      this._reconcileItems(updater);
    }
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }
}

class InsertItem<T> implements Effect {
  private _part: Part;

  private _referenceBinding: Binding<T> | null;

  private _containerPart: Part;

  constructor(
    part: Part,
    referenceBinding: Binding<T> | null,
    containerPart: Part,
  ) {
    this._part = part;
    this._referenceBinding = referenceBinding;
    this._containerPart = containerPart;
  }

  commit(): void {
    const referenceNode =
      this._referenceBinding?.startNode ?? this._containerPart.node;
    referenceNode.before(this._part.node);
  }
}

class MoveItem<T> implements Effect {
  private _binding: Binding<T>;

  private _referenceBinding: Binding<T> | null;

  private _containerPart: Part;

  constructor(
    binding: Binding<T>,
    referenceBinding: Binding<T> | null,
    containerPart: Part,
  ) {
    this._binding = binding;
    this._referenceBinding = referenceBinding;
    this._containerPart = containerPart;
  }

  commit(): void {
    const { startNode, endNode } = this._binding;
    const referenceNode =
      this._referenceBinding?.startNode ?? this._containerPart.node;
    reorderNodes(startNode, endNode, referenceNode);
  }
}

class RemoveItem implements Effect {
  private _part: Part;

  constructor(part: Part) {
    this._part = part;
  }

  commit(): void {
    this._part.node.remove();
  }
}

function generateIndexMap<T>(
  elements: T[],
  start: number,
  end: number,
): Map<T, number> {
  const map = new Map();
  for (let i = start; i <= end; i++) {
    map.set(elements[i], i);
  }
  return map;
}

function indexSelector<TItem>(_item: TItem, index: number): number {
  return index;
}

function insertItem<TKey, TValue>(
  key: TKey,
  value: TValue,
  referenceBinding: Binding<TValue> | null,
  containerPart: Part,
  updater: Updater,
): Binding<TValue> {
  const part = {
    type: PartType.ChildNode,
    node: document.createComment(''),
  } as const;
  const binding = resolveBinding(value, part, updater);

  DEBUG: {
    part.node.nodeValue = String(key);
  }

  updater.enqueueMutationEffect(
    new InsertItem(part, referenceBinding, containerPart),
  );
  binding.connect(updater);

  return binding;
}

function moveItem<T>(
  binding: Binding<T>,
  referenceBinding: Binding<T> | null,
  containerPart: Part,
  updater: Updater,
): void {
  updater.enqueueMutationEffect(
    new MoveItem(binding, referenceBinding, containerPart),
  );
}

function removeItem<T>(binding: Binding<T>, updater: Updater): void {
  binding.unbind(updater);
  updater.enqueueMutationEffect(new RemoveItem(binding.part));
}

function reorderNodes(
  startNode: Node,
  endNode: Node,
  referenceNode: ChildNode,
): void {
  // Elements must be collected first to avoid infinite loop.
  const targetNodes: Node[] = [];

  let currentNode: Node | null = startNode;

  do {
    targetNodes.push(currentNode);
    if (currentNode === endNode) {
      break;
    }
    currentNode = currentNode.nextSibling;
  } while (currentNode !== null);

  referenceNode.before(...targetNodes);
}
