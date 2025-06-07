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

export type List<TSource, TKey, TValue> = {
  sources: readonly TSource[];
  keySelector: (source: TSource, index: number) => TKey;
  valueSelector: (source: TSource, index: number) => Bindable<TValue>;
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

interface Item<TKey, TValue> {
  slot: Slot<TValue>;
  sentinelNode: ChildNode;
  key: TKey;
}

export function list<TSource, TKey, TValue>(
  sources: readonly TSource[],
  valueSelector: (
    source: TSource,
    key: number,
  ) => TValue = defaultValueSelector,
): DirectiveElement<List<TSource, TKey, TValue>> {
  return createDirectiveElement(ListDirective, {
    sources,
    keySelector: defaultKeySelector,
    valueSelector,
  });
}

export function sortableList<TSource, TKey, TValue>(
  sources: readonly TSource[],
  keySelector: (source: TSource, key: number) => TKey,
  valueSelector: (
    source: TSource,
    key: number,
  ) => TValue = defaultValueSelector,
): DirectiveElement<List<TSource, TKey, TValue>> {
  return createDirectiveElement(ListDirective, {
    sources,
    keySelector,
    valueSelector,
  });
}

export const ListDirective: Directive<List<any, any, any>> = {
  name: 'ListDirective',
  resolveBinding(
    list: List<unknown, unknown, unknown>,
    part: Part,
    _context: DirectiveContext,
  ): ListBinding<unknown, unknown, unknown> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'List directive must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(list)),
      );
    }
    return new ListBinding(list, part);
  },
};

class ListBinding<TSource, TKey, TValue>
  implements Binding<List<TSource, TKey, TValue>>, Effect
{
  private _list: List<TSource, TKey, TValue>;

  private readonly _part: ChildNodePart;

  private _pendingItems: Item<TKey, TValue>[] = [];

  private _memoizedItems: Item<TKey, TValue>[] = [];

  private _pendingOperations: Operation<TKey, TValue>[] = [];

  constructor(list: List<TSource, TKey, TValue>, part: ChildNodePart) {
    this._list = list;
    this._part = part;
  }

  get directive(): Directive<List<TSource, TKey, TValue>> {
    return ListDirective as Directive<List<TSource, TKey, TValue>>;
  }

  get value(): List<TSource, TKey, TValue> {
    return this._list;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  shouldBind(list: List<TSource, TKey, TValue>): boolean {
    return (
      this._memoizedItems.length !== this._list.sources.length ||
      list !== this._list
    );
  }

  bind(list: List<TSource, TKey, TValue>): void {
    this._list = list;
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    const { sources, keySelector, valueSelector } = this._list;
    const newItems = new Array(sources.length);
    const document = this._part.node.ownerDocument;

    for (let i = 0, l = newItems.length; i < l; i++) {
      const key = keySelector(sources[i]!, i);
      const value = valueSelector(sources[i]!, i);
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
    const { sources, keySelector, valueSelector } = this._list;
    const oldItems = this._pendingItems;
    const newKeys = sources.map(keySelector);
    const newValues = sources.map(valueSelector);
    const document = this._part.node.ownerDocument;

    this._pendingItems = reconcileItems(oldItems, newKeys, newValues, {
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
        if (this._memoizedItems.length > 0) {
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
        if (this._memoizedItems.length > 0) {
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
        if (this._memoizedItems.length > 0) {
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
    if (this._memoizedItems.length === 0) {
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

    this._pendingOperations = [];
    this._memoizedItems = this._pendingItems;
  }

  rollback(): void {
    for (let i = this._memoizedItems.length - 1; i >= 0; i--) {
      const item = this._memoizedItems[i]!;
      commitRemove(item);
    }

    this._pendingOperations = [];
    this._memoizedItems = [];
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

function defaultValueSelector(_value: unknown, index: number): any {
  return index;
}

function reconcileItems<TKey, TValue>(
  oldItems: Item<TKey, TValue>[],
  newKeys: TKey[],
  newValues: Bindable<TValue>[],
  handler: ReconciliationHandler<TKey, TValue>,
): Item<TKey, TValue>[] {
  const newItems = new Array(newKeys.length);

  let oldHead = 0;
  let oldTail = oldItems.length - 1;
  let newHead = 0;
  let newTail = newItems.length - 1;

  LOOP: while (true) {
    switch (true) {
      case newHead > newTail:
        while (oldHead <= oldTail) {
          handler.remove(oldItems[oldHead]!);
          oldHead++;
        }
        break LOOP;
      case oldHead > oldTail:
        while (newHead <= newTail) {
          newItems[newHead] = handler.insert(
            newKeys[newHead]!,
            newValues[newHead]!,
            newItems[newTail + 1],
          );
          newHead++;
        }
        break LOOP;
      case oldItems[oldHead]!.key === newKeys[newHead]:
        newItems[newHead] = handler.update(
          oldItems[oldHead]!,
          newValues[newHead]!,
        );
        newHead++;
        oldHead++;
        break;
      case oldItems[oldTail]!.key === newKeys[newTail]:
        newItems[newTail] = handler.update(
          oldItems[oldTail]!,
          newValues[newTail]!,
        );
        newTail--;
        oldTail--;
        break;
      case oldItems[oldHead]!.key === newKeys[newTail]:
        newItems[newTail] = handler.move(
          oldItems[oldHead]!,
          newValues[newTail]!,
          newItems[newTail + 1]!,
        );
        newTail--;
        oldHead++;
        break;
      case oldItems[oldTail]!.key === newKeys[newHead]:
        newItems[newHead] = handler.move(
          oldItems[oldTail]!,
          newValues[newHead]!,
          oldItems[oldHead]!,
        );
        newHead++;
        oldTail--;
        break;
      default:
        const oldIndexMap = new Map();
        for (let i = oldHead; i <= oldTail; i++) {
          oldIndexMap.set(oldItems[i]!.key, i);
        }
        while (newHead <= newTail) {
          const key = newKeys[newTail];
          const oldIndex = oldIndexMap.get(key);
          if (oldIndex !== undefined) {
            newItems[newTail] = handler.move(
              oldItems[oldIndex]!,
              newValues[newTail]!,
              newItems[newTail + 1],
            );
            oldIndexMap.delete(key);
          } else {
            newItems[newTail] = handler.insert(
              newKeys[newTail]!,
              newValues[newTail]!,
              newItems[newTail + 1],
            );
          }
          newTail--;
        }
        for (const oldIndex of oldIndexMap.values()) {
          handler.remove(oldItems[oldIndex]!);
        }
        break LOOP;
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
