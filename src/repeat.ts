/// <reference path="../typings/moveBefore.d.ts" />

import { formatPart } from './debug/part.js';
import { markUsedValue } from './debug/value.js';
import { DirectiveSpecifier } from './directive.js';
import {
  type Binding,
  type DirectiveContext,
  type DirectiveType,
  getStartNode,
  HydrationError,
  type HydrationTarget,
  type Part,
  PartType,
  replaceMarkerNode,
  type Slot,
  type UpdateSession,
} from './internal.js';

const OPERATION_INSERT = 0;
const OPERATION_MOVE = 1;
const OPERATION_MOVE_AND_UPDATE = 2;
const OPERATION_REMOVE = 3;
const OPERATION_UPDATE = 4;

export type RepeatProps<TSource, TKey = unknown, TValue = unknown> = {
  source: Iterable<TSource>;
  keySelector?: (element: TSource, index: number) => TKey;
  valueSelector?: (element: TSource, index: number) => TValue;
};

interface Item<TKey, TValue> {
  key: TKey;
  value: TValue;
}

type Operation<TKey, TValue> =
  | {
      type: typeof OPERATION_INSERT;
      item: Item<TKey, TValue>;
      referenceItem: Item<TKey, TValue> | undefined;
    }
  | {
      type: typeof OPERATION_MOVE;
      item: Item<TKey, TValue>;
      referenceItem: Item<TKey, TValue> | undefined;
    }
  | {
      type: typeof OPERATION_MOVE_AND_UPDATE;
      item: Item<TKey, TValue>;
      referenceItem: Item<TKey, TValue> | undefined;
    }
  | { type: typeof OPERATION_UPDATE; item: Item<TKey, TValue> }
  | { type: typeof OPERATION_REMOVE; item: Item<TKey, TValue> };

interface ReconciliationHandler<TKey, TSource, TTarget> {
  insert(
    newItem: Item<TKey, TSource>,
    referenceItem: Item<TKey, TTarget> | undefined,
  ): Item<TKey, TTarget>;
  update(
    item: Item<TKey, TTarget>,
    newItem: Item<TKey, TSource>,
  ): Item<TKey, TTarget>;
  move(
    item: Item<TKey, TTarget>,
    newItem: Item<TKey, TSource>,
    referenceItem: Item<TKey, TTarget> | undefined,
  ): Item<TKey, TTarget>;
  remove(item: Item<TKey, TTarget>): void;
}

export function Repeat<TSource, TKey, TValue>(
  props: RepeatProps<TSource, TKey, TValue>,
): DirectiveSpecifier<RepeatProps<TSource, TKey, TValue>> {
  return new DirectiveSpecifier(RepeatDirective, props);
}

export const RepeatDirective: DirectiveType<RepeatProps<any, any, any>> = {
  name: 'RepeatDirective',
  resolveBinding<TSource, TKey, TValue>(
    props: RepeatProps<TSource, TKey, TValue>,
    part: Part,
    _session: DirectiveContext,
  ): RepeatBinding<TSource, TKey, TValue> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'RepeatDirective must be used in a child part, but it is used here in:\n' +
          formatPart(part, markUsedValue(new DirectiveSpecifier(this, props))),
      );
    }
    return new RepeatBinding(props, part);
  },
};

export class RepeatBinding<TSource, TKey, TValue>
  implements Binding<RepeatProps<TSource, TKey, TValue>>
{
  value: RepeatProps<TSource, TKey, TValue>;

  readonly part: Part.ChildNodePart;

  private _pendingItems: Item<TKey, Slot<TValue>>[] = [];

  private _memoizedItems: Item<TKey, Slot<TValue>>[] | null = null;

  private _pendingOperations: Operation<TKey, Slot<TValue>>[] = [];

  constructor(
    value: RepeatProps<TSource, TKey, TValue>,
    part: Part.ChildNodePart,
  ) {
    this.value = value;
    this.part = part;
  }

  get type(): DirectiveType<RepeatProps<TSource, TKey, TValue>> {
    return RepeatDirective;
  }

  shouldBind(value: RepeatProps<TSource, TKey, TValue>): boolean {
    return (
      this._memoizedItems === null ||
      value.source !== this.value.source ||
      value.keySelector !== this.value.keySelector ||
      value.valueSelector !== this.value.valueSelector
    );
  }

  hydrate(target: HydrationTarget, session: UpdateSession): void {
    if (this._memoizedItems !== null || this._pendingItems.length > 0) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initialized.',
      );
    }

    const { context } = session;
    const document = this.part.node.ownerDocument;
    const sourceItems = generateItems(this.value);
    const targetItems: Item<TKey, Slot<TValue>>[] = new Array(
      sourceItems.length,
    );

    for (let i = 0, l = sourceItems.length; i < l; i++) {
      const { key, value } = sourceItems[i]!;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: this.part.namespaceURI,
      };
      const slot = context.resolveSlot(value, part);

      slot.hydrate(target, session);

      replaceMarkerNode(target, part.node);

      targetItems[i] = {
        key,
        value: slot,
      };
    }

    this.part.anchorNode = getAnchorNode(targetItems);
    this._pendingItems = targetItems;
    this._memoizedItems = targetItems;
  }

  connect(session: UpdateSession): void {
    const { context } = session;
    const document = this.part.node.ownerDocument;
    const targetItems = this._pendingItems;
    const sourceItems = generateItems(this.value);

    this._pendingItems = reconcileItems(targetItems, sourceItems, {
      insert: ({ key, value }, referenceItem) => {
        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: this.part.namespaceURI,
        };
        const slot = context.resolveSlot(value, part);
        const item = {
          key,
          value: slot,
        };
        slot.connect(session);
        this._pendingOperations.push({
          type: OPERATION_INSERT,
          item,
          referenceItem,
        });
        return item;
      },
      update: (item, { value }) => {
        if (item.value.reconcile(value, session)) {
          this._pendingOperations.push({
            type: OPERATION_UPDATE,
            item,
          });
        }
        return item;
      },
      move: (item, { value }, referenceItem) => {
        if (item.value.reconcile(value, session)) {
          this._pendingOperations.push({
            type: OPERATION_MOVE_AND_UPDATE,
            item,
            referenceItem,
          });
        } else {
          this._pendingOperations.push({
            type: OPERATION_MOVE,
            item,
            referenceItem,
          });
        }
        return item;
      },
      remove: (item) => {
        item.value.disconnect(session);
        this._pendingOperations.push({
          type: OPERATION_REMOVE,
          item,
        });
      },
    });
  }

  disconnect(session: UpdateSession): void {
    for (let i = this._pendingItems.length - 1; i >= 0; i--) {
      const { value } = this._pendingItems[i]!;
      value.disconnect(session);
    }
  }

  commit(): void {
    for (let i = 0, l = this._pendingOperations.length; i < l; i++) {
      const operation = this._pendingOperations[i]!;
      switch (operation.type) {
        case OPERATION_INSERT: {
          const { item, referenceItem } = operation;
          insertItem(item, referenceItem, this.part);
          item.value.commit();
          break;
        }
        case OPERATION_MOVE: {
          const { item, referenceItem } = operation;
          moveItem(item, referenceItem, this.part);
          break;
        }
        case OPERATION_MOVE_AND_UPDATE: {
          const { item, referenceItem } = operation;
          moveItem(item, referenceItem, this.part);
          item.value.commit();
          break;
        }
        case OPERATION_UPDATE: {
          const { item } = operation;
          item.value.commit();
          break;
        }
        case OPERATION_REMOVE: {
          const { item } = operation;
          item.value.rollback();
          item.value.part.node.remove();
          break;
        }
      }
    }

    this.part.anchorNode = getAnchorNode(this._pendingItems);
    this._memoizedItems = this._pendingItems;
    this._pendingOperations = [];
  }

  rollback(): void {
    if (this._memoizedItems !== null) {
      for (let i = this._memoizedItems.length - 1; i >= 0; i--) {
        const item = this._memoizedItems[i]!;
        item.value.rollback();
        item.value.part.node.remove();
      }
    }

    this.part.anchorNode = null;
    this._pendingItems = [];
    this._memoizedItems = null;
    this._pendingOperations = [];
  }
}

/**
 * @internal
 */
export function moveChildNodes(
  childNodes: ChildNode[],
  referenceNode: Node,
): void {
  const { parentNode } = referenceNode;

  if (parentNode !== null) {
    const insertOrMoveBefore =
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;

    for (let i = 0, l = childNodes.length; i < l; i++) {
      insertOrMoveBefore.call(parentNode, childNodes[i]!, referenceNode);
    }
  }
}

function defaultKeySelector(_element: unknown, index: number): any {
  return index;
}

function defaultValueSelector(element: unknown): any {
  return element;
}

function generateItems<TSource, TKey, TValue>({
  source,
  keySelector = defaultKeySelector,
  valueSelector = defaultValueSelector,
}: RepeatProps<TSource, TKey, TValue>): Item<TKey, TValue>[] {
  return Array.from(source, (element, i) => {
    const key = keySelector(element, i);
    const value = valueSelector(element, i);
    return { key, value };
  });
}

function getAnchorNode<TKey, TValue>(
  items: Item<TKey, Slot<TValue>>[],
): ChildNode | null {
  return items.length > 0 ? getStartNode(items[0]!.value.part) : null;
}

function getChildNodes(startNode: ChildNode, endNode: ChildNode): ChildNode[] {
  const childNodes = [startNode];
  let currentNode: ChildNode | null = startNode;

  while (currentNode !== endNode && currentNode.nextSibling !== null) {
    currentNode = currentNode.nextSibling;
    childNodes.push(currentNode);
  }

  return childNodes;
}

function insertItem<TKey, TValue>(
  item: Item<TKey, Slot<TValue>>,
  referenceItem: Item<TKey, Slot<TValue>> | undefined,
  part: Part,
): void {
  const referenceNode =
    referenceItem !== undefined
      ? getStartNode(referenceItem.value.part)
      : part.node;
  referenceNode.before(item.value.part.node);
}

function matchesItem<TKey, TSource, TTarget>(
  targetItem: Item<TKey, TTarget>,
  sourceItem: Item<TKey, TSource>,
) {
  return Object.is(targetItem.key, sourceItem.key);
}

function moveItem<TKey, TValue>(
  item: Item<TKey, Slot<TValue>>,
  referenceItem: Item<TKey, Slot<TValue>> | undefined,
  part: Part,
): void {
  const startNode = getStartNode(item.value.part);
  const endNode = item.value.part.node;
  const childNodes = getChildNodes(startNode, endNode);
  const referenceNode =
    referenceItem !== undefined
      ? getStartNode(referenceItem.value.part)
      : part.node;
  moveChildNodes(childNodes, referenceNode);
}

function reconcileItems<TKey, TSource, TTarget>(
  oldTargetItems: (Item<TKey, TTarget> | undefined)[],
  newSourceItems: Item<TKey, TSource>[],
  handler: ReconciliationHandler<TKey, TSource, TTarget>,
): Item<TKey, TTarget>[] {
  const newTargetItems: Item<TKey, TTarget>[] = new Array(
    newSourceItems.length,
  );

  let oldHead = 0;
  let oldTail = oldTargetItems.length - 1;
  let newHead = 0;
  let newTail = newTargetItems.length - 1;

  while (true) {
    if (newHead > newTail) {
      while (oldHead <= oldTail) {
        handler.remove(oldTargetItems[oldHead]!);
        oldHead++;
      }
      break;
    } else if (oldHead > oldTail) {
      while (newHead <= newTail) {
        newTargetItems[newHead] = handler.insert(
          newSourceItems[newHead]!,
          newTargetItems[newTail + 1],
        );
        newHead++;
      }
      break;
    } else if (
      matchesItem(oldTargetItems[oldHead]!, newSourceItems[newHead]!)
    ) {
      newTargetItems[newHead] = handler.update(
        oldTargetItems[oldHead]!,
        newSourceItems[newHead]!,
      );
      newHead++;
      oldHead++;
    } else if (
      matchesItem(oldTargetItems[oldTail]!, newSourceItems[newTail]!)
    ) {
      newTargetItems[newTail] = handler.update(
        oldTargetItems[oldTail]!,
        newSourceItems[newTail]!,
      );
      newTail--;
      oldTail--;
    } else if (
      matchesItem(oldTargetItems[oldHead]!, newSourceItems[newTail]!)
    ) {
      newTargetItems[newTail] = handler.move(
        oldTargetItems[oldHead]!,
        newSourceItems[newTail]!,
        newTargetItems[newTail + 1],
      );
      newTail--;
      oldHead++;
    } else if (
      matchesItem(oldTargetItems[oldTail]!, newSourceItems[newHead]!)
    ) {
      newTargetItems[newHead] = handler.move(
        oldTargetItems[oldTail]!,
        newSourceItems[newHead]!,
        oldTargetItems[oldHead],
      );
      newHead++;
      oldTail--;
    } else {
      const oldIndexMap = new Map();
      for (let index = oldHead; index <= oldTail; index++) {
        oldIndexMap.set(oldTargetItems[index]!.key, index);
      }
      while (newHead <= newTail) {
        const newSourceItem = newSourceItems[newTail]!;
        const oldIndex = oldIndexMap.get(newSourceItem.key);

        if (oldIndex !== undefined && oldTargetItems[oldIndex] !== undefined) {
          newTargetItems[newTail] = handler.move(
            oldTargetItems[oldIndex],
            newSourceItem,
            newTargetItems[newTail + 1],
          );
          oldTargetItems[oldIndex] = undefined;
        } else {
          newTargetItems[newTail] = handler.insert(
            newSourceItem,
            newTargetItems[newTail + 1],
          );
        }
        newTail--;
      }
      for (let i = oldHead; i <= oldTail; i++) {
        if (oldTargetItems[i] !== undefined) {
          handler.remove(oldTargetItems[i]!);
        }
      }
      break;
    }
  }

  return newTargetItems;
}
