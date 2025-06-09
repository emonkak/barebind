/// <reference path="../../../typings/moveBefore.d.ts" />

import {
  type Bindable,
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type Effect,
  type Slot,
  type UpdateContext,
  createDirectiveElement,
} from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { HydrationTree } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';

export type ListProps<TSource, TKey, TValue> = {
  source: Iterable<TSource>;
  keySelector?: (value: TSource, index: number) => TKey;
  valueSelector?: (value: TSource, index: number) => Bindable<TValue>;
};

interface ReconciliationHandler<TKey, TValue> {
  insert(
    key: TKey,
    value: Bindable<TValue>,
    referenceItem: Item<TKey, TValue> | undefined,
  ): Item<TKey, TValue>;
  update(item: Item<TKey, TValue>, value: Bindable<TValue>): Item<TKey, TValue>;
  move(
    item: Item<TKey, TValue>,
    value: Bindable<TValue>,
    referenceItem: Item<TKey, TValue> | undefined,
  ): Item<TKey, TValue>;
  remove(item: Item<TKey, TValue>): void;
}

interface Item<TKey, TValue> {
  key: TKey;
  sentinelNode: ChildNode;
  slot: Slot<TValue>;
}

interface KeyValuePair<TKey, TValue> {
  key: TKey;
  value: Bindable<TValue>;
}

type Operation<TKey, TValue> =
  | {
      type: typeof OperationType.Insert;
      item: Item<TKey, TValue>;
      referenceItem: Item<TKey, TValue> | undefined;
    }
  | {
      type: typeof OperationType.Move;
      item: Item<TKey, TValue>;
      referenceItem: Item<TKey, TValue> | undefined;
    }
  | { type: typeof OperationType.Remove; item: Item<TKey, TValue> };

const OperationType = {
  Insert: 0,
  Move: 1,
  Remove: 2,
} as const;

type OperationType = (typeof OperationType)[keyof typeof OperationType];

export function list<TSource, TKey, TValue>(
  props: ListProps<TSource, TKey, TValue>,
): DirectiveElement<ListProps<TSource, TKey, TValue>> {
  return createDirectiveElement(ListDirective, props);
}

export const ListDirective: Directive<ListProps<any, any, any>> = {
  name: 'ListDirective',
  resolveBinding(
    props: ListProps<unknown, unknown, unknown>,
    part: Part,
    _context: DirectiveContext,
  ): ListBinding<unknown, unknown, unknown> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'List directive must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(list)),
      );
    }
    return new ListBinding(props, part);
  },
};

class ListBinding<TSource, TKey, TValue>
  implements Binding<ListProps<TSource, TKey, TValue>>, Effect
{
  private _props: ListProps<TSource, TKey, TValue>;

  private readonly _part: ChildNodePart;

  private _pendingItems: Item<TKey, TValue>[] = [];

  private _memoizedItems: Item<TKey, TValue>[] | null = null;

  private _pendingOperations: Operation<TKey, TValue>[] = [];

  constructor(props: ListProps<TSource, TKey, TValue>, part: ChildNodePart) {
    this._props = props;
    this._part = part;
  }

  get directive(): Directive<ListProps<TSource, TKey, TValue>> {
    return ListDirective as Directive<ListProps<TSource, TKey, TValue>>;
  }

  get value(): ListProps<TSource, TKey, TValue> {
    return this._props;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  shouldBind(list: ListProps<TSource, TKey, TValue>): boolean {
    return this._memoizedItems === null || list !== this._props;
  }

  bind(props: ListProps<TSource, TKey, TValue>): void {
    this._props = props;
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    const newPairs = generateKeyValuePairs(this._props);
    const newItems = new Array(newPairs.length);
    const document = this._part.node.ownerDocument;

    for (let i = 0, l = newPairs.length; i < l; i++) {
      const { key, value } = newPairs[i]!;
      const sentinelNode = hydrationTree.popComment();
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const slot = context.resolveSlot(value, part);
      slot.hydrate(hydrationTree, context);
      hydrationTree.popComment().replaceWith(part.node);
      newItems[i] = {
        key,
        sentinelNode,
        slot,
      };
    }

    this._pendingItems = newItems;
  }

  connect(context: UpdateContext): void {
    const oldItems = this._pendingItems;
    const newPairs = generateKeyValuePairs(this._props);
    const document = this._part.node.ownerDocument;
    const isEmpty =
      this._memoizedItems === null || this._memoizedItems.length === 0;

    this._pendingItems = reconcileItems(oldItems, newPairs, {
      insert: (key, value, referenceItem) => {
        const sentinelNode = document.createComment('');
        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
        } as const;
        const slot = context.resolveSlot(value, part);
        slot.connect(context);
        const item: Item<TKey, TValue> = {
          key,
          sentinelNode,
          slot,
        };
        if (!isEmpty) {
          this._pendingOperations.push({
            type: OperationType.Insert,
            item,
            referenceItem,
          });
        }
        return item;
      },
      update: (item, value) => {
        item.slot.reconcile(value, context);
        return item;
      },
      move: (item, value, referenceItem) => {
        item.slot.reconcile(value, context);
        if (!isEmpty) {
          this._pendingOperations.push({
            type: OperationType.Move,
            item,
            referenceItem,
          });
        }
        return item;
      },
      remove: (item) => {
        item.slot.disconnect(context);
        if (!isEmpty) {
          this._pendingOperations.push({
            type: OperationType.Remove,
            item,
          });
        }
      },
    });
  }

  disconnect(context: UpdateContext): void {
    for (let i = this._pendingItems.length - 1; i >= 0; i--) {
      const item = this._pendingItems[i]!;
      item.slot.disconnect(context);
    }
  }

  commit(): void {
    if (this._memoizedItems === null || this._memoizedItems.length === 0) {
      for (let i = 0, l = this._pendingItems.length; i < l; i++) {
        const item = this._pendingItems[i]!;
        commitInsert(item, this._part.node);
      }
    } else {
      for (let i = 0, l = this._pendingOperations.length; i < l; i++) {
        const action = this._pendingOperations[i]!;
        switch (action.type) {
          case OperationType.Insert: {
            const referenceNode =
              action.referenceItem?.sentinelNode ?? this._part.node;
            commitInsert(action.item, referenceNode);
            break;
          }
          case OperationType.Move: {
            const referenceNode =
              action.referenceItem?.sentinelNode ?? this._part.node;
            commitMove(action.item, referenceNode);
            break;
          }
          case OperationType.Remove:
            commitRemove(action.item);
            break;
        }
      }
    }

    for (let i = 0, l = this._pendingItems.length; i < l; i++) {
      const item = this._pendingItems[i]!;
      const { slot, sentinelNode, key } = item;
      DEBUG: {
        sentinelNode.nodeValue = inspectValue(key);
        slot.part.node.nodeValue = `${inspectValue(key)}: ${slot.directive.name}`;
      }
      slot.commit();
    }

    this._memoizedItems = this._pendingItems;
    this._pendingOperations = [];
  }

  rollback(): void {
    if (this._memoizedItems !== null) {
      for (let i = this._memoizedItems.length - 1; i >= 0; i--) {
        const item = this._memoizedItems[i]!;
        commitRemove(item);
      }
    }

    this._pendingOperations = [];
    this._memoizedItems = null;
  }
}

function commitInsert<TKey, TValue>(
  item: Item<TKey, TValue>,
  referenceNode: ChildNode,
): void {
  const { slot, sentinelNode } = item;
  referenceNode.before(sentinelNode, slot.part.node);
}

function commitMove<TKey, TValue>(
  item: Item<TKey, TValue>,
  referenceNode: ChildNode,
): void {
  const { slot, sentinelNode } = item;
  const { parentNode } = sentinelNode;
  if (parentNode !== null) {
    const insertOrMoveBefore =
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;
    const childNodes = selectChildNodes(sentinelNode, slot.part.node);
    for (let i = 0, l = childNodes.length; i < l; i++) {
      insertOrMoveBefore.call(parentNode, childNodes[i]!, referenceNode);
    }
  } else {
    referenceNode.before(sentinelNode, slot.part.node);
  }
}

function commitRemove<TKey, TValue>(item: Item<TKey, TValue>): void {
  const { slot, sentinelNode } = item;
  slot.rollback();
  DEBUG: {
    sentinelNode.nodeValue = '';
    slot.part.node.nodeValue = '';
  }
  sentinelNode.remove();
}

function defaultKeySelector(_value: unknown, index: number): any {
  return index;
}

function defaultValueSelector(value: unknown, _index: number): any {
  return value;
}

function generateKeyValuePairs<TSource, TKey, TValue>({
  source,
  keySelector = defaultKeySelector,
  valueSelector = defaultValueSelector,
}: ListProps<TSource, TKey, TValue>): KeyValuePair<TKey, TValue>[] {
  return Array.from(source, (value, i) => ({
    key: keySelector(value, i),
    value: valueSelector(value, i),
  }));
}

function reconcileItems<TKey, TValue>(
  oldItems: Item<TKey, TValue>[],
  newPairs: KeyValuePair<TKey, TValue>[],
  handler: ReconciliationHandler<TKey, TValue>,
): Item<TKey, TValue>[] {
  const newItems = new Array(newPairs.length);

  let oldHead = 0;
  let oldTail = oldItems.length - 1;
  let newHead = 0;
  let newTail = newItems.length - 1;

  while (true) {
    if (newHead > newTail) {
      while (oldHead <= oldTail) {
        handler.remove(oldItems[oldHead]!);
        oldHead++;
      }
      break;
    } else if (oldHead > oldTail) {
      while (newHead <= newTail) {
        const { key, value } = newPairs[newHead]!;
        newItems[newHead] = handler.insert(key, value, newItems[newTail + 1]);
        newHead++;
      }
      break;
    } else if (oldItems[oldHead]!.key === newPairs[newHead]!.key) {
      newItems[newHead] = handler.update(
        oldItems[oldHead]!,
        newPairs[newHead]!.value,
      );
      newHead++;
      oldHead++;
    } else if (oldItems[oldTail]!.key === newPairs[newTail]!.key) {
      newItems[newTail] = handler.update(
        oldItems[oldTail]!,
        newPairs[newTail]!.value,
      );
      newTail--;
      oldTail--;
    } else if (oldItems[oldHead]!.key === newPairs[newTail]!.key) {
      newItems[newTail] = handler.move(
        oldItems[oldHead]!,
        newPairs[newTail]!.value,
        oldItems[oldHead]!,
      );
      newTail--;
      oldHead++;
    } else if (oldItems[oldTail]!.key === newPairs[newHead]!.key) {
      newItems[newHead] = handler.move(
        oldItems[oldTail]!,
        newPairs[newHead]!.value,
        oldItems[oldHead]!,
      );
      newHead++;
      oldTail--;
    } else {
      const oldIndexMap = new Map();
      for (let i = oldHead; i <= oldTail; i++) {
        oldIndexMap.set(oldItems[i]!.key, i);
      }
      while (newHead <= newTail) {
        const { key, value } = newPairs[newTail]!;
        const oldIndex = oldIndexMap.get(key);
        if (oldIndex !== undefined) {
          newItems[newTail] = handler.move(
            oldItems[oldIndex]!,
            value,
            newItems[newTail + 1],
          );
          oldIndexMap.delete(key);
        } else {
          newItems[newTail] = handler.insert(key, value, newItems[newTail + 1]);
        }
        newTail--;
      }
      for (const oldIndex of oldIndexMap.values()) {
        handler.remove(oldItems[oldIndex]!);
      }
      break;
    }
  }

  return newItems;
}

function selectChildNodes(
  startNode: ChildNode,
  endNode: ChildNode,
): ChildNode[] {
  const selectedNodes = [startNode];
  let currentNode: ChildNode | null = startNode;
  while (
    currentNode !== endNode &&
    (currentNode = currentNode.nextSibling) !== null
  ) {
    selectedNodes.push(currentNode);
  }
  return selectedNodes;
}
