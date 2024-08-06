import {
  type Binding,
  type ChildNodePart,
  CommitStatus,
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

const FLAG_NONE = 0;
const FLAG_INSERTED = 1 << 0;
const FLAG_INSERTING = 1 << 1;
const FLAG_MOVING = 1 << 2;
const FLAG_REMOVING = 1 << 3;

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
  return new List(items, indexSelector, valueSelector);
}

export class List<TItem, TKey, TValue>
  implements Directive<List<TItem, TKey, TValue>>
{
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

  private _memoizedKeys: TKey[] = [];

  private _pendingBindings: ItemBinding<TValue>[] = [];

  private _memoizedBindings: ItemBinding<TValue>[] = [];

  private _status = CommitStatus.Committed;

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

  get bindings(): ItemBinding<TValue>[] {
    return this._pendingBindings;
  }

  connect(context: UpdateContext<unknown>): void {
    const { items, keySelector, valueSelector } = this._value;
    this._updateItems(items, keySelector, valueSelector, context);
    this._requestCommit(context);
    this._status = CommitStatus.Mounting;
  }

  bind(
    newValue: List<TItem, TKey, TValue>,
    context: UpdateContext<unknown>,
  ): void {
    DEBUG: {
      ensureDirective(List, newValue, this._part);
    }
    const { items, keySelector, valueSelector } = newValue;
    this._updateItems(items, keySelector, valueSelector, context);
    this._requestCommit(context);
    this._value = newValue;
    this._status = CommitStatus.Mounting;
  }

  unbind(context: UpdateContext<unknown>): void {
    this._clearItems(context);
    this._requestCommit(context);
    this._status = CommitStatus.Unmounting;
  }

  disconnect(): void {
    for (let i = 0, l = this._pendingBindings.length; i < l; i++) {
      this._pendingBindings[i]!.disconnect();
    }
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    if (this._status !== CommitStatus.Committed) {
      this._memoizedBindings = this._pendingBindings;
      this._status = CommitStatus.Committed;
    }
  }

  private _clearItems(context: UpdateContext<unknown>): void {
    for (let i = 0, l = this._pendingBindings.length; i < l; i++) {
      this._pendingBindings[i]!.unbind(context);
    }

    this._pendingBindings.length = 0;
  }

  private _insertItem(
    key: TKey,
    value: TValue,
    referenceBinding: Binding<TValue> | null,
    context: UpdateContext<unknown>,
  ): ItemBinding<TValue> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const binding = new ItemBinding(
      resolveBinding(value, part, context),
      referenceBinding,
      this._part,
    );

    DEBUG: {
      part.node.data = nameOf(value) + '@' + nameOf(key);
    }

    binding.connect(context);

    return binding;
  }

  private _reconcileItems(
    items: TItem[],
    keySelector: Selector<TItem, TKey>,
    valueSelector: Selector<TItem, TValue>,
    context: UpdateContext<unknown>,
  ): void {
    const oldBindings: (ItemBinding<TValue> | null)[] = this._pendingBindings;
    const newBindings = new Array<ItemBinding<TValue>>(items.length);
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
        binding.move(
          newValues[newTail]!,
          newBindings[newTail + 1] ?? null,
          context,
        );
        oldHead++;
        newTail--;
      } else if (oldKeys[oldTail] === newKeys[newHead]) {
        // Old tail matches new head; update and move to new head.
        const binding = (newBindings[newHead] = oldBindings[oldTail]!);
        binding.move(newValues[newHead]!, oldBindings[oldHead]!, context);
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
          oldBindings[oldHead]!.unbind(context);
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          // Old tail is no longer in new list; remove
          oldBindings[oldTail]!.unbind(context);
          oldTail--;
        } else {
          // Any mismatches at this point are due to additions or moves; see if
          // we have an old binding we can reuse and move into place.
          const oldIndex = oldKeyToIndexMap!.get(newKeys[newHead]!);
          if (oldIndex !== undefined && oldBindings[oldIndex] !== null) {
            // Reuse the old binding.
            const binding = (newBindings[newHead] = oldBindings[oldIndex]!);
            binding.move(newValues[newHead]!, oldBindings[oldHead]!, context);
            // This marks the old binding as having been used, so that it will
            // be skipped in the first two checks above.
            oldBindings[oldIndex] = null;
          } else {
            // No old binding for this value; create a new one and insert it.
            newBindings[newHead] = this._insertItem(
              newKeys[newHead]!,
              newValues[newHead]!,
              oldBindings[oldHead]!,
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
      newBindings[newHead] = this._insertItem(
        newKeys[newHead]!,
        newValues[newHead]!,
        newBindings[newTail + 1] ?? null,
        context,
      );
      newHead++;
    }

    // Remove any remaining unused old bindings.
    while (oldHead <= oldTail) {
      const oldBinding = oldBindings[oldHead]!;
      if (oldBinding !== null) {
        oldBinding.unbind(context);
      }
      oldHead++;
    }

    this._pendingBindings = newBindings;
    this._memoizedKeys = newKeys;
  }

  private _replaceItems(
    items: TItem[],
    keySelector: (item: TItem, index: number) => TKey,
    valueSelector: (item: TItem, index: number) => TValue,
    context: UpdateContext<unknown>,
  ): void {
    const newKeys = new Array<TKey>(items.length);
    const oldBindings = this._pendingBindings;
    const newBindings = new Array<ItemBinding<TValue>>(items.length);

    for (
      let i = 0, l = Math.min(oldBindings.length, items.length);
      i < l;
      i++
    ) {
      const item = items[i]!;
      const key = keySelector(item, i);
      const value = valueSelector(item, i);
      const binding = this._pendingBindings[i]!;
      binding.bind(value, context);
      newKeys[i] = key;
      newBindings[i] = binding;
    }

    for (let i = oldBindings.length, l = items.length; i < l; i++) {
      const item = items[i]!;
      const key = keySelector(item, i);
      const value = valueSelector(item, i);
      newKeys[i] = key;
      newBindings[i] = this._insertItem(key, value, null, context);
    }

    for (let i = items.length, l = oldBindings.length; i < l; i++) {
      oldBindings[i]!.unbind(context);
    }

    this._memoizedKeys = newKeys;
    this._pendingBindings = newBindings;
  }

  private _requestCommit(context: UpdateContext<unknown>): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
  }

  private _updateItems(
    items: TItem[],
    keySelector: Selector<TItem, TKey>,
    valueSelector: Selector<TItem, TValue>,
    context: UpdateContext<unknown>,
  ): void {
    if (this._pendingBindings.length === 0 || keySelector === indexSelector) {
      this._replaceItems(items, keySelector, valueSelector, context);
    } else {
      this._reconcileItems(items, keySelector, valueSelector, context);
    }
  }
}

class ItemBinding<TValue> implements Binding<TValue>, Effect {
  private readonly _binding: Binding<TValue>;

  private _referenceBinding: Binding<TValue> | null;

  private readonly _containerPart: ChildNodePart;

  private _flags = FLAG_NONE;

  constructor(
    binding: Binding<TValue>,
    referenceBinding: Binding<TValue> | null,
    containerPart: ChildNodePart,
  ) {
    this._binding = binding;
    this._referenceBinding = referenceBinding;
    this._containerPart = containerPart;
  }

  get value(): TValue {
    return this._binding.value;
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

  connect(context: UpdateContext<unknown>): void {
    this._requestCommit(context);
    this._flags |= FLAG_INSERTING;
    this._flags &= ~(FLAG_MOVING | FLAG_REMOVING);
    this._binding.connect(context);
  }

  bind(newValue: TValue, context: UpdateContext<unknown>): void {
    if (!(this._flags & FLAG_INSERTED)) {
      this._requestCommit(context);
      this._flags |= FLAG_INSERTING;
      this._flags &= ~(FLAG_MOVING | FLAG_REMOVING);
    }
    this._binding.bind(newValue, context);
  }

  unbind(context: UpdateContext<unknown>): void {
    this._binding.unbind(context);
    this._requestCommit(context);
    this._flags |= FLAG_REMOVING;
    this._flags &= ~(FLAG_INSERTING | FLAG_MOVING);
  }

  disconnect(): void {
    this._binding.disconnect();
    this._flags &= ~(FLAG_INSERTING | FLAG_MOVING | FLAG_REMOVING);
  }

  move(
    newValue: TValue,
    referenceBinding: Binding<TValue> | null,
    context: UpdateContext<unknown>,
  ): void {
    this._binding.bind(newValue, context);
    this._requestCommit(context);
    this._referenceBinding = referenceBinding;
    this._flags |= FLAG_MOVING;
    this._flags &= ~(FLAG_INSERTING | FLAG_REMOVING);
  }

  commit(): void {
    if (this._flags & FLAG_INSERTING) {
      const referenceNode =
        this._referenceBinding?.startNode ?? this._containerPart.node;
      referenceNode.before(this._binding.part.node);
      this._flags |= FLAG_INSERTED;
    } else if (this._flags & FLAG_MOVING) {
      const { startNode, endNode } = this._binding;
      const referenceNode =
        this._referenceBinding?.startNode ?? this._containerPart.node;
      moveNodes(startNode, endNode, referenceNode);
      this._flags |= FLAG_INSERTED;
    } else {
      this._binding.part.node.remove();
      this._flags &= ~FLAG_INSERTED;
    }
    this._flags &= ~(FLAG_INSERTING | FLAG_MOVING | FLAG_REMOVING);
  }

  private _requestCommit(context: UpdateContext<unknown>) {
    if (!(this._flags & (FLAG_INSERTING | FLAG_MOVING | FLAG_REMOVING))) {
      context.enqueueMutationEffect(this);
    }
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

function indexSelector(_item: unknown, index: number): number {
  return index;
}

function moveNodes(
  startNode: Node,
  endNode: Node,
  referenceNode: ChildNode,
): void {
  // Elements must be collected before inserting to avoid infinite loop.
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
