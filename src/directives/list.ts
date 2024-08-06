import {
  type Binding,
  type ChildNodePart,
  type Directive,
  type DirectiveContext,
  type Effect,
  type Part,
  PartType,
  type UpdateContext,
  directiveTag,
  nameOf,
} from '../baseTypes.js';
import { resolveBinding } from '../binding.js';
import { ensureDirective, reportPart } from '../error.js';

type Selector<TItem, TResult> = (item: TItem, index: number) => TResult;

export function list<TItem, TKey, TValue>(
  items: TItem[],
  keySelector: Selector<TItem, TKey>,
  valueSelector: Selector<TItem, TValue>,
): List<TItem, TKey, TValue> {
  return new List(items, keySelector, valueSelector);
}

export function inPlaceList<TItem, TValue>(
  items: TItem[],
  valueSelector: Selector<TItem, TValue>,
): List<TItem, number, TValue> {
  return new List(items, null, valueSelector);
}

export class List<TItem, TKey, TValue>
  implements Directive<List<TItem, TKey, TValue>>
{
  private readonly _items: TItem[];

  private readonly _keySelector: Selector<TItem, TKey> | null;

  private readonly _valueSelector: Selector<TItem, TValue>;

  constructor(
    items: TItem[],
    keySelector: Selector<TItem, TKey> | null,
    valueSelector: Selector<TItem, TValue>,
  ) {
    this._items = items;
    this._keySelector = keySelector;
    this._valueSelector = valueSelector;
  }

  get items(): TItem[] {
    return this._items;
  }

  get keySelector(): Selector<TItem, TKey> | null {
    return this._keySelector;
  }

  get valueSelector(): Selector<TItem, TValue> {
    return this._valueSelector;
  }

  [directiveTag](
    part: Part,
    _context: DirectiveContext,
  ): ListBinding<TItem, TKey, TValue> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'List directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new ListBinding(this, part);
  }
}

export class ListBinding<TItem, TKey, TValue>
  implements Binding<List<TItem, TKey, TValue>>, Effect
{
  private _value: List<TItem, TKey, TValue>;

  private readonly _part: ChildNodePart;

  private _pendingBindings: Binding<TValue>[] = [];

  private _memoizedBindings: Binding<TValue>[] = [];

  private _memoizedKeys: TKey[] = [];

  private _dirty = false;

  constructor(value: List<TItem, TKey, TValue>, part: ChildNodePart) {
    this._value = value;
    this._part = part;
  }

  get value(): List<TItem, TKey, TValue> {
    return this._value;
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

  connect(context: UpdateContext<unknown>): void {
    const { items, keySelector, valueSelector } = this._value;
    this._updateItems(items, keySelector, valueSelector, context);
    this._requestMutation(context);
  }

  bind(
    newValue: List<TItem, TKey, TValue>,
    context: UpdateContext<unknown>,
  ): void {
    DEBUG: {
      ensureDirective(List, newValue, this._part);
    }
    if (newValue.items !== this._value.items) {
      const { items, keySelector, valueSelector } = newValue;
      this._updateItems(items, keySelector, valueSelector, context);
      this._requestMutation(context);
    }
    this._value = newValue;
  }

  unbind(context: UpdateContext<unknown>): void {
    this._clearItems(context);
    this._requestMutation(context);
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

  private _clearItems(context: UpdateContext<unknown>): void {
    for (let i = 0, l = this._pendingBindings.length; i < l; i++) {
      removeItem(this._pendingBindings[i]!, context);
    }

    this._pendingBindings = [];
  }

  private _reconcileItemsByIndex(
    items: TItem[],
    valueSelector: (item: TItem, index: number) => TValue,
    context: UpdateContext<unknown>,
  ): void {
    const oldBindings = this._pendingBindings;
    const newBindings = new Array<Binding<TValue>>(items.length);

    for (
      let i = 0, l = Math.min(oldBindings.length, items.length);
      i < l;
      i++
    ) {
      const item = items[i]!;
      const value = valueSelector(item, i);
      const binding = this._pendingBindings[i]!;
      binding.bind(value, context);
      newBindings[i] = binding;
    }

    for (let i = oldBindings.length, l = items.length; i < l; i++) {
      const item = items[i]!;
      const value = valueSelector(item, i);
      newBindings[i] = insertItem(i, value, null, this._part, context);
    }

    for (let i = items.length, l = oldBindings.length; i < l; i++) {
      removeItem(oldBindings[i]!, context);
    }

    this._pendingBindings = newBindings;
  }

  private _reconcileItemsByKey(
    items: TItem[],
    keySelector: Selector<TItem, TKey>,
    valueSelector: Selector<TItem, TValue>,
    context: UpdateContext<unknown>,
  ): void {
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
        binding.bind(newValues[newHead]!, context);
        oldHead++;
        newHead++;
      } else if (oldKeys[oldTail] === newKeys[newTail]) {
        // Old tail matches new tail; update in place
        const binding = (newBindings[newTail] = oldBindings[oldTail]!);
        binding.bind(newValues[newTail]!, context);
        oldTail--;
        newTail--;
      } else if (oldKeys[oldHead] === newKeys[newTail]) {
        // Old tail matches new head; update and move to new head.
        const binding = (newBindings[newTail] = oldBindings[oldHead]!);
        binding.bind(newValues[newTail]!, context);
        moveItem(
          binding,
          newBindings[newTail + 1] ?? null,
          this._part,
          context,
        );
        oldHead++;
        newTail--;
      } else if (oldKeys[oldTail] === newKeys[newHead]) {
        // Old tail matches new head; update and move to new head.
        const binding = (newBindings[newHead] = oldBindings[oldTail]!);
        binding.bind(newValues[newHead]!, context);
        moveItem(binding, oldBindings[oldHead]!, this._part, context);
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
          removeItem(oldBindings[oldHead]!, context);
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          // Old tail is no longer in new list; remove
          removeItem(oldBindings[oldTail]!, context);
          oldTail--;
        } else {
          // Any mismatches at this point are due to additions or moves; see if
          // we have an old binding we can reuse and move into place.
          const oldIndex = oldKeyToIndexMap!.get(newKeys[newHead]!);
          if (oldIndex !== undefined && oldBindings[oldIndex] !== null) {
            // Reuse the old binding.
            const binding = (newBindings[newHead] = oldBindings[oldIndex]!);
            binding.bind(newValues[newHead]!, context);
            moveItem(binding, oldBindings[oldHead]!, this._part, context);
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
              context,
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
        context,
      );
      newHead++;
    }

    // Remove any remaining unused old bindings.
    while (oldHead <= oldTail) {
      const oldBinding = oldBindings[oldHead]!;
      if (oldBinding !== null) {
        removeItem(oldBinding, context);
      }
      oldHead++;
    }

    this._pendingBindings = newBindings;
    this._memoizedKeys = newKeys;
  }

  private _replaceItems(
    items: TItem[],
    keySelector: Selector<TItem, TKey>,
    valueSelector: Selector<TItem, TValue>,
    context: UpdateContext<unknown>,
  ): void {
    const newBindings = new Array<Binding<TValue>>(items.length);
    const newKeys = new Array<TKey>(items.length);

    for (let i = 0, l = items.length; i < l; i++) {
      const item = items[i]!;
      const key = keySelector(item, i);
      const value = valueSelector(item, i);
      newKeys[i] = key;
      newBindings[i] = insertItem(key, value, null, this._part, context);
    }

    this._pendingBindings = newBindings;
    this._memoizedKeys = newKeys;
  }

  private _updateItems(
    items: TItem[],
    keySelector: Selector<TItem, TKey> | null,
    valueSelector: Selector<TItem, TValue>,
    context: UpdateContext<unknown>,
  ): void {
    if (keySelector !== null) {
      if (this._pendingBindings.length === 0) {
        this._replaceItems(items, keySelector, valueSelector, context);
      } else {
        this._reconcileItemsByKey(items, keySelector, valueSelector, context);
      }
    } else {
      this._reconcileItemsByIndex(items, valueSelector, context);
    }
  }

  private _requestMutation(context: UpdateContext<unknown>): void {
    if (!this._dirty) {
      this._dirty = true;
      context.enqueueMutationEffect(this);
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
    moveNodes(startNode, endNode, referenceNode);
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

function insertItem<TKey, TValue>(
  key: TKey,
  value: TValue,
  referenceBinding: Binding<TValue> | null,
  containerPart: Part,
  context: UpdateContext<unknown>,
): Binding<TValue> {
  const part = {
    type: PartType.ChildNode,
    node: document.createComment(''),
  } as const;
  const binding = resolveBinding(value, part, context);

  DEBUG: {
    part.node.data = nameOf(value) + '@' + nameOf(key);
  }

  context.enqueueMutationEffect(
    new InsertItem(part, referenceBinding, containerPart),
  );
  binding.connect(context);

  return binding;
}

function moveItem<T>(
  binding: Binding<T>,
  referenceBinding: Binding<T> | null,
  containerPart: Part,
  context: UpdateContext<unknown>,
): void {
  context.enqueueMutationEffect(
    new MoveItem(binding, referenceBinding, containerPart),
  );
}

function moveNodes(
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

function removeItem<T>(
  binding: Binding<T>,
  context: UpdateContext<unknown>,
): void {
  binding.unbind(context);
  context.enqueueMutationEffect(new RemoveItem(binding.part));
}
