/// <reference path="../../../typings/moveBefore.d.ts" />

import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type Effect,
  type UpdateContext,
  createDirectiveElement,
} from '../directive.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';

export type ListValue<TItem, TKey, TResult> = {
  items: readonly TItem[];
  keySelector: (item: TItem, index: number) => TKey;
  valueSelector: (item: TItem, index: number) => TResult;
};

type Operation<TKey, TValue> =
  | {
      type: OperationType.Insert;
      slot: Slot<TKey, TValue>;
      forwardSlot: Slot<TKey, TValue> | undefined;
    }
  | {
      type: OperationType.Move;
      slot: Slot<TKey, TValue>;
      forwardSlot: Slot<TKey, TValue> | undefined;
    }
  | { type: OperationType.Remove; slot: Slot<TKey, TValue> };

const enum OperationType {
  Insert,
  Move,
  Remove,
}

interface Slot<TKey, TValue> {
  pendingBinding: Binding<TValue>;
  memoizedBinding: Binding<TValue> | null;
  sentinelNode: Comment;
  key: TKey;
}

export function list<TItem, TKey, TValue>(
  items: readonly TItem[],
  valueSelector: (item: TItem, key: number) => TValue = defaultValueSelector,
): DirectiveElement<ListValue<TItem, TKey, TValue>> {
  return createDirectiveElement(
    ListDirective as Directive<ListValue<TItem, TKey, TValue>>,
    {
      items,
      keySelector: defaultKeySelector,
      valueSelector,
    },
  );
}

export function sortableList<TItem, TKey, TValue>(
  items: readonly TItem[],
  keySelector: (item: TItem, key: number) => TKey,
  valueSelector: (item: TItem, key: number) => TValue = defaultValueSelector,
): DirectiveElement<ListValue<TItem, TKey, TValue>> {
  return createDirectiveElement(
    ListDirective as Directive<ListValue<TItem, TKey, TValue>>,
    {
      items,
      keySelector,
      valueSelector,
    },
  );
}

const ListDirective: Directive<ListValue<unknown, unknown, unknown>> = {
  get name(): string {
    return 'ListDirective';
  },
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

class ListBinding<TItem, TKey, TValue>
  implements Binding<ListValue<TItem, TKey, TValue>>, Effect
{
  private _value: ListValue<TItem, TKey, TValue>;

  private readonly _part: ChildNodePart;

  private _pendingOperations: Operation<TKey, TValue>[] = [];

  private _pendingSlots: Slot<TKey, TValue>[] = [];

  private _memoizedSlots: Slot<TKey, TValue>[] = [];

  constructor(value: ListValue<TItem, TKey, TValue>, part: ChildNodePart) {
    this._value = value;
    this._part = part;
  }

  get directive(): Directive<ListValue<TItem, TKey, TValue>> {
    return ListDirective as Directive<ListValue<TItem, TKey, TValue>>;
  }

  get value(): ListValue<TItem, TKey, TValue> {
    return this._value;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  connect(context: UpdateContext): void {
    if (this._pendingSlots.length === 0) {
      this._initializeSlots(this._value, context);
    } else {
      this._reconcileSlots(this._value, context);
    }
  }

  bind(value: ListValue<TItem, TKey, TValue>, context: UpdateContext): void {
    if (this._pendingSlots.length === 0) {
      this._initializeSlots(value, context);
    } else {
      this._reconcileSlots(value, context);
    }
    this._value = value;
  }

  disconnect(context: UpdateContext): void {
    for (let i = this._memoizedSlots.length - 1; i >= 0; i--) {
      const slot = this._memoizedSlots[i]!;
      slot.memoizedBinding?.disconnect(context);
    }
  }

  commit(): void {
    if (this._memoizedSlots.length === 0) {
      for (let i = 0, l = this._pendingSlots.length; i < l; i++) {
        const slot = this._pendingSlots[i]!;
        commitInsert(slot, this._part.node);
      }
    } else {
      for (let i = 0, l = this._pendingOperations.length; i < l; i++) {
        const action = this._pendingOperations[i]!;
        switch (action.type) {
          case OperationType.Insert: {
            const referenceNode =
              action.forwardSlot?.sentinelNode ?? this._part.node;
            commitInsert(action.slot, referenceNode);
            break;
          }
          case OperationType.Move: {
            const referenceNode =
              action.forwardSlot?.sentinelNode ?? this._part.node;
            commitMove(action.slot, referenceNode);
            break;
          }
          case OperationType.Remove:
            commitRemove(action.slot);
            break;
        }
      }
    }

    for (let i = 0, l = this._pendingSlots.length; i < l; i++) {
      const slot = this._pendingSlots[i]!;
      const { pendingBinding, memoizedBinding, sentinelNode, key } = slot;
      if (memoizedBinding !== pendingBinding) {
        memoizedBinding?.rollback();
      }
      DEBUG: {
        sentinelNode.nodeValue = inspectValue(key);
        pendingBinding.part.node.nodeValue = `${inspectValue(key)}: ${pendingBinding.directive.name}`;
      }
      pendingBinding.commit();
      slot.memoizedBinding = pendingBinding;
    }

    this._pendingOperations = [];
    this._memoizedSlots = this._pendingSlots;
  }

  rollback(): void {
    for (let i = this._memoizedSlots.length - 1; i >= 0; i--) {
      const slot = this._memoizedSlots[i]!;
      commitRemove(slot);
    }

    this._pendingOperations = [];
    this._memoizedSlots = [];
  }

  private _initializeSlots(
    { items, keySelector, valueSelector }: ListValue<TItem, TKey, TValue>,
    context: UpdateContext,
  ): void {
    const newSlots: Slot<TKey, TValue>[] = new Array(items.length);

    for (let i = 0, l = items.length; i < l; i++) {
      const key = keySelector(items[i]!, i);
      const value = valueSelector(items[i]!, i);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = context.resolveBinding(value, part);
      const slot: Slot<TKey, TValue> = {
        key,
        sentinelNode: document.createComment(''),
        pendingBinding: binding,
        memoizedBinding: null,
      };
      binding.connect(context);
      newSlots.push(slot);
      i++;
    }

    this._pendingSlots = newSlots;
  }

  private _reconcileSlots(
    { items, keySelector, valueSelector }: ListValue<TItem, TKey, TValue>,
    context: UpdateContext,
  ): void {
    const oldSlots = this._pendingSlots;
    const newSlots = new Array(items.length);
    const newKeys = items.map(keySelector);
    const newValues = items.map(valueSelector);

    const insertSlot = (
      index: number,
      forwardSlot: Slot<TKey, TValue> | undefined,
    ) => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = context.resolveBinding(newValues[index]!, part);
      const slot: Slot<TKey, TValue> = {
        key: newKeys[index]!,
        sentinelNode: document.createComment(''),
        pendingBinding: binding,
        memoizedBinding: null,
      };
      binding.connect(context);
      newSlots[index] = slot;
      this._pendingOperations.push({
        type: OperationType.Insert,
        slot,
        forwardSlot,
      });
    };
    const updateSlot = (slot: Slot<TKey, TValue>, index: number) => {
      slot.pendingBinding = context.reconcileBinding(
        slot.pendingBinding,
        newValues[index]!,
      );
      newSlots[index] = slot;
    };
    const moveSlot = (
      slot: Slot<TKey, TValue>,
      index: number,
      forwardSlot: Slot<TKey, TValue> | undefined,
    ) => {
      slot.pendingBinding = context.reconcileBinding(
        slot.pendingBinding,
        newValues[index]!,
      );
      newSlots[index] = slot;
      this._pendingOperations.push({
        type: OperationType.Move,
        slot,
        forwardSlot,
      });
    };
    const removeSlot = (slot: Slot<TKey, TValue>) => {
      slot.pendingBinding.disconnect(context);
      this._pendingOperations.push({
        type: OperationType.Remove,
        slot,
      });
    };

    let oldHead = 0;
    let oldTail = oldSlots.length - 1;
    let newHead = 0;
    let newTail = newSlots.length - 1;

    loop: while (true) {
      switch (true) {
        case newHead > newTail:
          while (oldHead <= oldTail) {
            removeSlot(oldSlots[oldHead]!);
            oldHead++;
          }
          break loop;
        case oldHead > oldTail:
          while (newHead <= newTail) {
            insertSlot(newHead, newSlots[newTail + 1]);
            newHead++;
          }
          break loop;
        case oldSlots[oldHead]!.key === newKeys[newHead]:
          updateSlot(oldSlots[oldHead]!, newHead);
          newHead++;
          oldHead++;
          break;
        case oldSlots[oldTail]!.key === newKeys[newTail]:
          updateSlot(oldSlots[oldTail]!, newTail);
          newTail--;
          oldTail--;
          break;
        case oldSlots[oldHead]!.key === newKeys[newTail]:
          moveSlot(oldSlots[oldHead]!, newTail, newSlots[newTail + 1]);
          newTail--;
          oldHead++;
          break;
        case oldSlots[oldTail]!.key === newKeys[newHead]:
          moveSlot(oldSlots[oldTail]!, newHead, oldSlots[oldHead]);
          newHead++;
          oldTail--;
          break;
        default:
          const oldIndexMap = new Map();
          for (let i = oldHead; i <= oldTail; i++) {
            oldIndexMap.set(oldSlots[i]!.key, i);
          }
          while (newHead <= newTail) {
            const key = newKeys[newTail];
            const oldIndex = oldIndexMap.get(key);
            if (oldIndex !== undefined) {
              moveSlot(oldSlots[oldIndex]!, newTail, newSlots[newTail + 1]);
              oldIndexMap.delete(key);
            } else {
              insertSlot(newTail, newSlots[newTail + 1]);
            }
            newTail--;
          }
          for (const oldIndex of oldIndexMap.values()) {
            removeSlot(oldSlots[oldIndex]!);
          }
          break loop;
      }
    }

    this._pendingSlots = newSlots;
  }
}

function commitInsert<TKey, TValue>(
  slot: Slot<TKey, TValue>,
  referenceNode: ChildNode,
): void {
  const { pendingBinding, sentinelNode } = slot;
  referenceNode.before(sentinelNode, pendingBinding.part.node);
}

function commitMove<TKey, TValue>(
  slot: Slot<TKey, TValue>,
  referenceNode: ChildNode,
): void {
  const { pendingBinding, memoizedBinding, sentinelNode } = slot;
  const parentNode = sentinelNode.parentNode;
  if (memoizedBinding !== pendingBinding) {
    memoizedBinding?.rollback();
  }
  if (parentNode !== null) {
    const insertOrMoveBefore =
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;
    const childNodes = selectChildNodes(sentinelNode, pendingBinding.part.node);
    for (let i = 0, l = childNodes.length; i < l; i++) {
      insertOrMoveBefore.call(parentNode, childNodes[i]!, referenceNode);
    }
  } else {
    referenceNode.before(sentinelNode, pendingBinding.part.node);
  }
}

function commitRemove<TKey, TValue>(slot: Slot<TKey, TValue>): void {
  const { memoizedBinding, sentinelNode } = slot;
  if (memoizedBinding !== null) {
    memoizedBinding.rollback();
    memoizedBinding.part.node.remove();
  }
  sentinelNode.remove();
  slot.memoizedBinding = null;
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
