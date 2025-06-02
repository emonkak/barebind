/// <reference path="../../../typings/moveBefore.d.ts" />

import {
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
import { type ChildNodePart, type Part, PartType } from '../part.js';

export type ListValue<TSource, TKey, TResult> = {
  sources: readonly TSource[];
  keySelector: (source: TSource, index: number) => TKey;
  valueSelector: (source: TSource, index: number) => TResult;
};

type Operation<TKey, TValue> =
  | {
      type: typeof OperationType.Insert;
      item: Item<TKey, TValue>;
      forwardItem: Item<TKey, TValue> | undefined;
    }
  | {
      type: typeof OperationType.Move;
      item: Item<TKey, TValue>;
      forwardItem: Item<TKey, TValue> | undefined;
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
): DirectiveElement<ListValue<TSource, TKey, TValue>> {
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
): DirectiveElement<ListValue<TSource, TKey, TValue>> {
  return createDirectiveElement(ListDirective, {
    sources,
    keySelector,
    valueSelector,
  });
}

export const ListDirective: Directive<ListValue<any, any, any>> = {
  name: 'ListDirective',
  resolveBinding(
    value: ListValue<unknown, unknown, unknown>,
    part: Part,
    _context: DirectiveContext,
  ): ListBinding<unknown, unknown, unknown> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'List directive must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new ListBinding(value, part);
  },
};

class ListBinding<TSource, TKey, TValue>
  implements Binding<ListValue<TSource, TKey, TValue>>, Effect
{
  private _value: ListValue<TSource, TKey, TValue>;

  private readonly _part: ChildNodePart;

  private _pendingItems: Item<TKey, TValue>[] = [];

  private _memoizedItems: Item<TKey, TValue>[] = [];

  private _pendingOperations: Operation<TKey, TValue>[] = [];

  constructor(value: ListValue<TSource, TKey, TValue>, part: ChildNodePart) {
    this._value = value;
    this._part = part;
  }

  get directive(): Directive<ListValue<TSource, TKey, TValue>> {
    return ListDirective as Directive<ListValue<TSource, TKey, TValue>>;
  }

  get value(): ListValue<TSource, TKey, TValue> {
    return this._value;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  shouldBind(value: ListValue<TSource, TKey, TValue>): boolean {
    return (
      this._memoizedItems.length !== this._value.sources.length ||
      value !== this._value
    );
  }

  bind(value: ListValue<TSource, TKey, TValue>): void {
    this._value = value;
  }

  connect(context: UpdateContext): void {
    const { sources, keySelector, valueSelector } = this._value;
    const oldItems = this._pendingItems;
    const newItems = new Array(sources.length);
    const newKeys = sources.map(keySelector);
    const newValues = sources.map(valueSelector);

    const insertItem = (
      index: number,
      forwardItem: Item<TKey, TValue> | undefined,
    ) => {
      const part = {
        type: PartType.ChildNode,
        node: context.createMarkerNode(),
      } as const;
      const slot = context.resolveSlot(newValues[index]!, part);
      const item: Item<TKey, TValue> = {
        key: newKeys[index]!,
        sentinelNode: context.createMarkerNode(),
        slot,
      };
      newItems[index] = item;
      this._pendingOperations.push({
        type: OperationType.Insert,
        item,
        forwardItem,
      });
    };
    const updateItem = (item: Item<TKey, TValue>, index: number) => {
      item.slot.reconcile(newValues[index]!, context);
      newItems[index] = item;
    };
    const moveItem = (
      item: Item<TKey, TValue>,
      index: number,
      forwardItem: Item<TKey, TValue> | undefined,
    ) => {
      item.slot.reconcile(newValues[index]!, context);
      newItems[index] = item;
      this._pendingOperations.push({
        type: OperationType.Move,
        item,
        forwardItem,
      });
    };
    const removeItem = (item: Item<TKey, TValue>) => {
      item.slot.disconnect(context);
      this._pendingOperations.push({
        type: OperationType.Remove,
        item,
      });
    };

    let oldHead = 0;
    let oldTail = oldItems.length - 1;
    let newHead = 0;
    let newTail = newItems.length - 1;

    loop: while (true) {
      switch (true) {
        case newHead > newTail:
          while (oldHead <= oldTail) {
            removeItem(oldItems[oldHead]!);
            oldHead++;
          }
          break loop;
        case oldHead > oldTail:
          while (newHead <= newTail) {
            insertItem(newHead, newItems[newTail + 1]);
            newHead++;
          }
          break loop;
        case oldItems[oldHead]!.key === newKeys[newHead]:
          updateItem(oldItems[oldHead]!, newHead);
          newHead++;
          oldHead++;
          break;
        case oldItems[oldTail]!.key === newKeys[newTail]:
          updateItem(oldItems[oldTail]!, newTail);
          newTail--;
          oldTail--;
          break;
        case oldItems[oldHead]!.key === newKeys[newTail]:
          moveItem(oldItems[oldHead]!, newTail, newItems[newTail + 1]);
          newTail--;
          oldHead++;
          break;
        case oldItems[oldTail]!.key === newKeys[newHead]:
          moveItem(oldItems[oldTail]!, newHead, oldItems[oldHead]);
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
              moveItem(oldItems[oldIndex]!, newTail, newItems[newTail + 1]);
              oldIndexMap.delete(key);
            } else {
              insertItem(newTail, newItems[newTail + 1]);
            }
            newTail--;
          }
          for (const oldIndex of oldIndexMap.values()) {
            removeItem(oldItems[oldIndex]!);
          }
          break loop;
      }
    }

    this._pendingItems = newItems;
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
              action.forwardItem?.sentinelNode ?? this._part.node;
            commitInsert(action.item, referenceNode);
            break;
          }
          case OperationType.Move: {
            const referenceNode =
              action.forwardItem?.sentinelNode ?? this._part.node;
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
  const parentNode = sentinelNode.parentNode;
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
