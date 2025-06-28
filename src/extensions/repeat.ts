/// <reference path="../../typings/moveBefore.d.ts" />

import { inspectPart, markUsedValue } from '../debug.js';
import {
  type Binding,
  type Directive,
  type DirectiveContext,
  DirectiveObject,
  type Effect,
  type Slot,
  type UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import {
  type ChildNodePart,
  getStartNode,
  type Part,
  PartType,
} from '../part.js';

export type RepeatProps<TSource, TKey, TValue> = {
  source: Iterable<TSource>;
  keySelector?: (value: TSource, index: number) => TKey;
  valueSelector?: (value: TSource, index: number) => TValue;
};

interface ReconciliationHandler<TKey, TValue> {
  insert(
    key: TKey,
    value: TValue,
    referenceItem: Item<TKey, TValue> | undefined,
  ): Item<TKey, TValue>;
  update(item: Item<TKey, TValue>, value: TValue): Item<TKey, TValue>;
  move(
    item: Item<TKey, TValue>,
    value: TValue,
    referenceItem: Item<TKey, TValue> | undefined,
  ): Item<TKey, TValue>;
  remove(item: Item<TKey, TValue>): void;
}

interface Item<TKey, TValue> {
  key: TKey;
  slot: Slot<TValue>;
}

interface KeyValuePair<TKey, TValue> {
  key: TKey;
  value: TValue;
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

export function repeat<TSource, TKey, TValue>(
  props: RepeatProps<TSource, TKey, TValue>,
): DirectiveObject<RepeatProps<TSource, TKey, TValue>> {
  return new DirectiveObject(
    RepeatDirective as Directive<RepeatProps<TSource, TKey, TValue>>,
    props,
  );
}

export const RepeatDirective = {
  name: 'RepeatDirective',
  resolveBinding<TSource, TKey, TValue>(
    props: RepeatProps<TSource, TKey, TValue>,
    part: Part,
    _context: DirectiveContext,
  ): RepeatBinding<TSource, TKey, TValue> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'RepeatDirective must be used in a child part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(props)),
      );
    }
    return new RepeatBinding(props, part);
  },
} as const satisfies Directive<RepeatProps<unknown, unknown, unknown>>;

export class RepeatBinding<TSource, TKey, TValue>
  implements Binding<RepeatProps<TSource, TKey, TValue>>, Effect
{
  private _props: RepeatProps<TSource, TKey, TValue>;

  private readonly _part: ChildNodePart;

  private _pendingItems: Item<TKey, TValue>[] = [];

  private _memoizedItems: Item<TKey, TValue>[] | null = null;

  private _pendingOperations: Operation<TKey, TValue>[] = [];

  constructor(props: RepeatProps<TSource, TKey, TValue>, part: ChildNodePart) {
    this._props = props;
    this._part = part;
  }

  get directive(): Directive<RepeatProps<TSource, TKey, TValue>> {
    return RepeatDirective as Directive<RepeatProps<TSource, TKey, TValue>>;
  }

  get value(): RepeatProps<TSource, TKey, TValue> {
    return this._props;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  shouldBind(props: RepeatProps<TSource, TKey, TValue>): boolean {
    return this._memoizedItems === null || props !== this._props;
  }

  bind(props: RepeatProps<TSource, TKey, TValue>): void {
    this._props = props;
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    const newPairs = generateKeyValuePairs(this._props);
    const newItems = new Array(newPairs.length);
    const document = this._part.node.ownerDocument;

    for (let i = 0, l = newPairs.length; i < l; i++) {
      const { key, value } = newPairs[i]!;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const slot = context.resolveSlot(value, part);

      slot.hydrate(hydrationTree, context);
      hydrationTree.popNode(part.node.nodeType, part.node.nodeName);
      hydrationTree.replaceNode(part.node);

      newItems[i] = {
        key,
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
        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
          childNode: null,
        } as const;
        const slot = context.resolveSlot(value, part);
        slot.connect(context);
        const item: Item<TKey, TValue> = {
          key,
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
        const operation = this._pendingOperations[i]!;
        switch (operation.type) {
          case OperationType.Insert: {
            const referenceNode =
              operation.referenceItem !== undefined
                ? getStartNode(operation.referenceItem.slot.part)
                : this._part.node;
            commitInsert(operation.item, referenceNode);
            break;
          }
          case OperationType.Move: {
            const referenceNode =
              operation.referenceItem !== undefined
                ? getStartNode(operation.referenceItem.slot.part)
                : this._part.node;
            commitMove(operation.item, referenceNode);
            break;
          }
          case OperationType.Remove:
            commitRemove(operation.item);
            break;
        }
      }
    }

    for (let i = 0, l = this._pendingItems.length; i < l; i++) {
      const { slot } = this._pendingItems[i]!;
      slot.commit();
    }

    if (this._pendingItems.length > 0) {
      this._part.childNode = getStartNode(this._pendingItems[0]!.slot.part);
    } else {
      this._part.childNode = null;
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

    this._part.childNode = null;
    this._memoizedItems = null;
    this._pendingOperations = [];
  }
}

function commitInsert<TKey, TValue>(
  item: Item<TKey, TValue>,
  referenceNode: ChildNode,
): void {
  const { slot, key } = item;
  referenceNode.before(slot.part.node);
}

function commitMove<TKey, TValue>(
  item: Item<TKey, TValue>,
  referenceNode: ChildNode,
): void {
  const { slot } = item;
  const { parentNode } = slot.part.node;
  if (parentNode !== null) {
    const insertOrMoveBefore =
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;
    const childNodes = selectChildNodes(slot.part as ChildNodePart);
    for (let i = 0, l = childNodes.length; i < l; i++) {
      insertOrMoveBefore.call(parentNode, childNodes[i]!, referenceNode);
    }
  } else {
    referenceNode.before(slot.part.node);
  }
}

function commitRemove<TKey, TValue>(item: Item<TKey, TValue>): void {
  const { slot } = item;

  slot.rollback();
  slot.part.node.remove();
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
}: RepeatProps<TSource, TKey, TValue>): KeyValuePair<TKey, TValue>[] {
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
        newItems[newTail + 1]!,
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

function selectChildNodes(part: ChildNodePart): ChildNode[] {
  const startNode = part.childNode ?? part.node;
  const endNode = part.node;
  const childNodes = [startNode];
  let currentNode: ChildNode | null = startNode;

  while (
    currentNode !== endNode &&
    (currentNode = currentNode.nextSibling) !== null
  ) {
    childNodes.push(currentNode);
  }

  return childNodes;
}
