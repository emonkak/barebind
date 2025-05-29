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
  binding: Binding<TValue>;
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
    context: DirectiveContext,
  ): ListBinding<unknown, unknown, unknown> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'List directive must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new ListBinding(value, part, context);
  },
};

export class ListBinding<TItem, TKey, TValue>
  implements Binding<ListValue<TItem, TKey, TValue>>, Effect
{
  private _value: ListValue<TItem, TKey, TValue>;

  private readonly _part: ChildNodePart;

  private _pendingSlots: Slot<TKey, TValue>[];

  private _memoizedSlots: Slot<TKey, TValue>[] = [];

  private _pendingOperations: Operation<TKey, TValue>[] = [];

  constructor(
    value: ListValue<TItem, TKey, TValue>,
    part: ChildNodePart,
    context: DirectiveContext,
  ) {
    const { items, keySelector, valueSelector } = value;
    const slots: Slot<TKey, TValue>[] = new Array(items.length);

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
        binding,
      };
      slots.push(slot);
      i++;
    }

    this._pendingSlots = slots;
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

  bind(value: ListValue<TItem, TKey, TValue>, context: UpdateContext): boolean {
    const dirty = value !== this._value;
    if (dirty) {
      this._value = value;
      this.connect(context);
    }
    return dirty;
  }

  connect(context: UpdateContext): void {
    const { items, keySelector, valueSelector } = this._value;
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
        binding: binding,
      };
      newSlots[index] = slot;
      this._pendingOperations.push({
        type: OperationType.Insert,
        slot,
        forwardSlot,
      });
    };
    const updateSlot = (slot: Slot<TKey, TValue>, index: number) => {
      slot.binding.bind(newValues[index]!, context);
      newSlots[index] = slot;
    };
    const moveSlot = (
      slot: Slot<TKey, TValue>,
      index: number,
      forwardSlot: Slot<TKey, TValue> | undefined,
    ) => {
      slot.binding.bind(newValues[index]!, context);
      newSlots[index] = slot;
      this._pendingOperations.push({
        type: OperationType.Move,
        slot,
        forwardSlot,
      });
    };
    const removeSlot = (slot: Slot<TKey, TValue>) => {
      slot.binding.disconnect(context);
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

  disconnect(context: UpdateContext): void {
    for (let i = this._pendingSlots.length - 1; i >= 0; i--) {
      const slot = this._pendingSlots[i]!;
      slot.binding.disconnect(context);
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
      const { binding, sentinelNode, key } = slot;
      DEBUG: {
        sentinelNode.nodeValue = inspectValue(key);
        binding.part.node.nodeValue = `${inspectValue(key)}: ${binding.directive.name}`;
      }
      binding.commit();
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
}

function commitInsert<TKey, TValue>(
  slot: Slot<TKey, TValue>,
  referenceNode: ChildNode,
): void {
  const { binding, sentinelNode } = slot;
  referenceNode.before(sentinelNode, binding.part.node);
}

function commitMove<TKey, TValue>(
  slot: Slot<TKey, TValue>,
  referenceNode: ChildNode,
): void {
  const { binding, sentinelNode } = slot;
  const parentNode = sentinelNode.parentNode;
  if (parentNode !== null) {
    const insertOrMoveBefore =
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;
    const childNodes = selectChildNodes(sentinelNode, binding.part.node);
    for (let i = 0, l = childNodes.length; i < l; i++) {
      insertOrMoveBefore.call(parentNode, childNodes[i]!, referenceNode);
    }
  } else {
    referenceNode.before(sentinelNode, binding.part.node);
  }
}

function commitRemove<TKey, TValue>(slot: Slot<TKey, TValue>): void {
  const { binding, sentinelNode } = slot;
  binding.rollback();
  DEBUG: {
    sentinelNode.nodeValue = '';
    binding.part.node.nodeValue = '';
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
