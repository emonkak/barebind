/// <reference path="../../typings/moveBefore.d.ts" />

import { inspectPart, markUsedValue } from '../debug.js';
import {
  type Binding,
  type CommitContext,
  type Directive,
  type DirectiveContext,
  DirectiveObject,
  isBindable,
  type Slot,
  type UpdateContext,
} from '../directive.js';
import { HydrationError, type HydrationTree } from '../hydration.js';
import {
  type ChildNodePart,
  getChildNodes,
  getStartNode,
  moveChildNodes,
  type Part,
  PartType,
} from '../part.js';

export type RepeatProps<TSource, TKey = unknown, TValue = unknown> = {
  source: Iterable<TSource>;
  keySelector?: (element: TSource, index: number) => TKey;
  valueSelector?: (element: TSource, index: number) => TValue;
  itemTypeResolver?: (element: TSource, key: TKey, value: TValue) => ItemType;
};

export type ItemType =
  | { type: typeof Node.COMMENT_NODE }
  | { type: typeof Node.TEXT_NODE }
  | { type: typeof Node.ELEMENT_NODE; name: string };

interface Item<TKey, TValue> {
  type: ItemType;
  key: TKey;
  value: TValue;
}

type Operation<TKey, TValue> =
  | {
      type: typeof OperationType.Insert;
      item: Item<TKey, Slot<TValue>>;
      referenceItem: Item<TKey, Slot<TValue>> | undefined;
    }
  | {
      type: typeof OperationType.Move;
      item: Item<TKey, Slot<TValue>>;
      referenceItem: Item<TKey, Slot<TValue>> | undefined;
    }
  | { type: typeof OperationType.Remove; item: Item<TKey, Slot<TValue>> };

const OperationType = {
  Insert: 0,
  Move: 1,
  Remove: 2,
} as const;

interface ReconciliationHandler<TKey, TTarget, TSource> {
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

export function repeat<TTarget, TKey, TValue>(
  props: RepeatProps<TTarget, TKey, TValue>,
): DirectiveObject<RepeatProps<TTarget, TKey, TValue>> {
  return new DirectiveObject(
    RepeatDirective as Directive<RepeatProps<TTarget, TKey, TValue>>,
    props,
  );
}

export const RepeatDirective: Directive<RepeatProps<any, any, any>> = {
  name: 'RepeatDirective',
  resolveBinding<TTarget, TKey, TValue>(
    props: RepeatProps<TTarget, TKey, TValue>,
    part: Part,
    _context: DirectiveContext,
  ): RepeatBinding<TTarget, TKey, TValue> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'RepeatDirective must be used in a child part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(props)),
      );
    }
    return new RepeatBinding(props, part);
  },
};

export class RepeatBinding<TTarget, TKey, TValue>
  implements Binding<RepeatProps<TTarget, TKey, TValue>>
{
  private _props: RepeatProps<TTarget, TKey, TValue>;

  private readonly _part: ChildNodePart;

  private _pendingItems: Item<TKey, Slot<TValue>>[] = [];

  private _memoizedItems: Item<TKey, Slot<TValue>>[] | null = null;

  private _pendingOperations: Operation<TKey, TValue>[] = [];

  constructor(props: RepeatProps<TTarget, TKey, TValue>, part: ChildNodePart) {
    this._props = props;
    this._part = part;
  }

  get directive(): Directive<RepeatProps<TTarget, TKey, TValue>> {
    return RepeatDirective;
  }

  get value(): RepeatProps<TTarget, TKey, TValue> {
    return this._props;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  shouldBind(props: RepeatProps<TTarget, TKey, TValue>): boolean {
    return this._memoizedItems === null || props !== this._props;
  }

  bind(props: RepeatProps<TTarget, TKey, TValue>): void {
    this._props = props;
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    if (this._memoizedItems !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initilized.',
      );
    }

    const sourceItems = generateItems(this._props);
    const targetItems: Item<TKey, Slot<TValue>>[] = new Array(
      sourceItems.length,
    );
    const document = this._part.node.ownerDocument;

    for (let i = 0, l = sourceItems.length; i < l; i++) {
      const { type, key, value } = sourceItems[i]!;
      const part = hydratePart(type, hydrationTree, document);
      const slot = context.resolveSlot(value, part);

      slot.hydrate(hydrationTree, context);

      if (part.node.parentNode === null) {
        hydrationTree
          .popNode(part.node.nodeType, part.node.nodeName)
          .replaceWith(part.node);
      }

      targetItems[i] = {
        type,
        key,
        value: slot,
      };
    }

    this._pendingItems = targetItems;
    this._memoizedItems = targetItems;
  }

  connect(context: UpdateContext): void {
    const targetItems = this._pendingItems;
    const sourceItems = generateItems(this._props);
    const document = this._part.node.ownerDocument;

    this._pendingItems = reconcileItems(targetItems, sourceItems, {
      insert: ({ type, key, value }, referenceItem) => {
        const part = createPart(type, document);
        const slot = context.resolveSlot(value, part);
        slot.connect(context);
        const item: Item<TKey, Slot<TValue>> = {
          type,
          key,
          value: slot,
        };
        this._pendingOperations.push({
          type: OperationType.Insert,
          item,
          referenceItem,
        });
        return item;
      },
      update: (item, { value }) => {
        item.value.reconcile(value, context);
        return item;
      },
      move: (item, { value }, referenceItem) => {
        item.value.reconcile(value, context);
        this._pendingOperations.push({
          type: OperationType.Move,
          item,
          referenceItem,
        });
        return item;
      },
      remove: (item) => {
        item.value.disconnect(context);
        this._pendingOperations.push({
          type: OperationType.Remove,
          item,
        });
      },
    });
  }

  disconnect(context: UpdateContext): void {
    for (let i = this._pendingItems.length - 1; i >= 0; i--) {
      const item = this._pendingItems[i]!;
      item.value.disconnect(context);
    }
  }

  commit(context: CommitContext): void {
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
                ? getStartNode(operation.referenceItem.value.part)
                : this._part.node;
            commitInsert(operation.item, referenceNode);
            break;
          }
          case OperationType.Move: {
            const referenceNode =
              operation.referenceItem !== undefined
                ? getStartNode(operation.referenceItem.value.part)
                : this._part.node;
            commitMove(operation.item, referenceNode);
            break;
          }
          case OperationType.Remove:
            commitRemove(operation.item, context);
            break;
        }
      }
    }

    for (let i = 0, l = this._pendingItems.length; i < l; i++) {
      const { value } = this._pendingItems[i]!;
      value.commit(context);
    }

    if (this._pendingItems.length > 0) {
      this._part.childNode = getStartNode(this._pendingItems[0]!.value.part);
    } else {
      this._part.childNode = null;
    }

    this._memoizedItems = this._pendingItems;
    this._pendingOperations = [];
  }

  rollback(context: CommitContext): void {
    if (this._memoizedItems !== null) {
      for (let i = this._memoizedItems.length - 1; i >= 0; i--) {
        const item = this._memoizedItems[i]!;
        commitRemove(item, context);
      }
    }

    this._part.childNode = null;
    this._memoizedItems = null;
    this._pendingOperations = [];
  }
}

function commitInsert<TKey, TValue>(
  item: Item<TKey, Slot<TValue>>,
  referenceNode: ChildNode,
): void {
  const { value } = item;
  referenceNode.before(value.part.node);
}

function commitMove<TKey, TValue>(
  item: Item<TKey, Slot<TValue>>,
  referenceNode: ChildNode,
): void {
  const { value } = item;
  const childNodes = getChildNodes(value.part as ChildNodePart);
  moveChildNodes(childNodes, referenceNode);
}

function commitRemove<TKey, TValue>(
  item: Item<TKey, Slot<TValue>>,
  context: CommitContext,
): void {
  const { value } = item;

  value.rollback(context);
  value.part.node.remove();
}

function createPart(type: ItemType, document: Document): Part {
  switch (type.type) {
    case Node.COMMENT_NODE:
      return {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
    case Node.TEXT_NODE:
      return {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
    case Node.ELEMENT_NODE:
      return {
        type: PartType.Element,
        node: document.createElement(type.name),
      };
  }
}

function defaultItemTypeResolver(
  _element: unknown,
  _key: unknown,
  value: unknown,
): ItemType {
  return isBindable(value)
    ? { type: Node.COMMENT_NODE }
    : { type: Node.TEXT_NODE };
}

function defaultKeySelector(_element: unknown, index: number): any {
  return index;
}

function defaultValueSelector(element: unknown): any {
  return element;
}

function generateItems<TTarget, TKey, TValue>({
  source,
  keySelector = defaultKeySelector,
  valueSelector = defaultValueSelector,
  itemTypeResolver = defaultItemTypeResolver,
}: RepeatProps<TTarget, TKey, TValue>): Item<TKey, TValue>[] {
  return Array.from(source, (element, i) => {
    const key = keySelector(element, i);
    const value = valueSelector(element, i);
    const type = itemTypeResolver(element, key, value);
    return { type, key, value };
  });
}

function hydratePart(
  type: ItemType,
  hydrationTree: HydrationTree,
  document: Document,
): Part {
  switch (type.type) {
    case Node.COMMENT_NODE:
      return {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
    case Node.TEXT_NODE:
      return {
        type: PartType.Text,
        node: hydrationTree.popNode(Node.TEXT_NODE, '#text'),
        precedingText: '',
        followingText: '',
      };
    case Node.ELEMENT_NODE:
      return {
        type: PartType.Element,
        node: hydrationTree.popNode(Node.ELEMENT_NODE, type.name.toUpperCase()),
      };
  }
}

function isEqualItemType(firstType: ItemType, secondType: ItemType) {
  switch (firstType.type) {
    case Node.ELEMENT_NODE:
      return (
        firstType.type === secondType.type && firstType.name === secondType.name
      );
    default:
      return firstType.type === secondType.type;
  }
}

function matchesItem<TKey, TTarget, TSource>(
  targetItem: Item<TKey, TTarget>,
  sourceItem: Item<TKey, TSource>,
) {
  return (
    isEqualItemType(targetItem.type, sourceItem.type) &&
    Object.is(targetItem.key, sourceItem.key)
  );
}

function reconcileItems<TKey, TTarget, TSource>(
  oldTargetItems: (Item<TKey, TTarget> | undefined)[],
  newSourceItems: Item<TKey, TSource>[],
  handler: ReconciliationHandler<TKey, TTarget, TSource>,
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
        newTargetItems[newTail + 1]!,
      );
      newTail--;
      oldHead++;
    } else if (
      matchesItem(oldTargetItems[oldTail]!, newSourceItems[newHead]!)
    ) {
      newTargetItems[newHead] = handler.move(
        oldTargetItems[oldTail]!,
        newSourceItems[newHead]!,
        oldTargetItems[oldHead]!,
      );
      newHead++;
      oldTail--;
    } else {
      const oldIndexMap = new Map();
      for (let i = oldHead; i <= oldTail; i++) {
        oldIndexMap.set(oldTargetItems[i]!.key, i);
      }
      while (newHead <= newTail) {
        const newSourceItem = newSourceItems[newTail]!;
        const oldIndex = oldIndexMap.get(newSourceItem.key);

        if (
          oldIndex !== undefined &&
          oldTargetItems[oldIndex] !== undefined &&
          isEqualItemType(oldTargetItems[oldIndex].type, newSourceItem.type)
        ) {
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
