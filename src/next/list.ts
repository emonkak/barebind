/// <reference path="../../typings/moveBefore.d.ts" />

import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type Effect,
  type EffectContext,
  type UpdateContext,
  createDirectiveElement,
} from './coreTypes.js';
import { inspectPart, inspectValue, markUsedValue } from './debug.js';
import { type ChildNodePart, type Part, PartType } from './part.js';

export type ListValue<TItem, TKey, TResult> = {
  items: readonly TItem[] | Iterable<TItem>;
  keySelector: (item: TItem, index: number) => TKey;
  valueSelector: (item: TItem, index: number) => TResult;
};

type Action<TKey, TValue> =
  | {
      type: ActionType.Mount;
      slot: Slot<TKey, TValue>;
      reference: Slot<TKey, TValue> | undefined;
    }
  | { type: ActionType.Update; slot: Slot<TKey, TValue> }
  | {
      type: ActionType.Move;
      slot: Slot<TKey, TValue>;
      reference: Slot<TKey, TValue> | undefined;
    }
  | { type: ActionType.Unmount; slot: Slot<TKey, TValue> };

enum ActionType {
  Mount,
  Update,
  Move,
  Unmount,
}

interface Slot<TKey, TValue> {
  binding: Binding<TValue>;
  sentinelNode: Comment;
  key: TKey;
}

export function inPlaceList<TItem, TKey, TValue>(
  items: readonly TItem[] | Iterable<TItem>,
  valueSelector: (item: TItem, key: number) => TValue = defaultValueSelector,
): DirectiveElement<ListValue<TItem, TKey, TValue>> {
  return createDirectiveElement(
    List as Directive<ListValue<TItem, TKey, TValue>>,
    {
      items,
      keySelector: defaultKeySelector,
      valueSelector,
    },
  );
}

export function sortableList<TItem, TKey, TValue>(
  items: readonly TItem[] | Iterable<TItem>,
  keySelector: (item: TItem, key: number) => TKey,
  valueSelector: (item: TItem, key: number) => TValue = defaultValueSelector,
): DirectiveElement<ListValue<TItem, TKey, TValue>> {
  return createDirectiveElement(
    List as Directive<ListValue<TItem, TKey, TValue>>,
    {
      items,
      keySelector,
      valueSelector,
    },
  );
}

const List: Directive<ListValue<unknown, unknown, unknown>> = {
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

  private _pendingActions: Action<TKey, TValue>[] = [];

  private _pendingSlots: Slot<TKey, TValue>[] = [];

  private _memoizedSlots: Slot<TKey, TValue>[] = [];

  constructor(value: ListValue<TItem, TKey, TValue>, part: ChildNodePart) {
    this._value = value;
    this._part = part;
  }

  get directive(): Directive<ListValue<TItem, TKey, TValue>> {
    return List as Directive<ListValue<TItem, TKey, TValue>>;
  }

  get value(): ListValue<TItem, TKey, TValue> {
    return this._value;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  connect(context: UpdateContext): void {
    this._reconcileItems(this._value, context);
  }

  bind(value: ListValue<TItem, TKey, TValue>, context: UpdateContext): void {
    this._reconcileItems(value, context);
    this._value = value;
  }

  unbind(context: UpdateContext): void {
    const newActions: Action<TKey, TValue>[] = [];

    // Unbind slots in reverse order.
    for (let i = this._memoizedSlots.length - 1; i >= 0; i--) {
      const slot = this._memoizedSlots[i]!;
      slot.binding.unbind(context);
      newActions.push({
        type: ActionType.Unmount,
        slot,
      });
    }

    this._pendingActions = newActions;
    this._pendingSlots = [];
  }

  disconnect(context: UpdateContext): void {
    // Disconnect slots in reverse order.
    for (let i = this._memoizedSlots.length - 1; i >= 0; i--) {
      this._memoizedSlots[i]!.binding.disconnect(context);
    }

    this._pendingActions = [];
    this._pendingSlots = this._memoizedSlots;
  }

  commit(context: EffectContext): void {
    for (let i = 0, l = this._pendingActions.length; i < l; i++) {
      const action = this._pendingActions[i]!;
      switch (action.type) {
        case ActionType.Mount: {
          const referenceNode =
            action.reference?.sentinelNode ?? this._part.node;
          commitMount(action.slot, referenceNode, context);
          break;
        }
        case ActionType.Update: {
          commitUpdate(action.slot, context);
          break;
        }
        case ActionType.Move: {
          const referenceNode =
            action.reference?.sentinelNode ?? this._part.node;
          commitMove(action.slot, referenceNode, context);
          break;
        }
        case ActionType.Unmount:
          commitUnmount(action.slot, context);
          break;
      }
    }

    this._pendingActions = [];
    this._memoizedSlots = this._pendingSlots;
  }

  private _reconcileItems(
    { items, keySelector, valueSelector }: ListValue<TItem, TKey, TValue>,
    context: UpdateContext,
  ): void {
    const oldSlots = this._memoizedSlots;
    const newActions: Action<TKey, TValue>[] = [];
    let newSlots: Slot<TKey, TValue>[];
    let newKeys: TKey[];
    let newValues: TValue[];

    if (Array.isArray(items)) {
      newSlots = new Array(items.length);
      newKeys = items.map(keySelector);
      newValues = items.map(valueSelector);
    } else {
      let i = 0;
      newKeys = [];
      newValues = [];
      for (const item of items) {
        newKeys.push(keySelector(item, i));
        newValues.push(valueSelector(item, i));
        i++;
      }
      newSlots = new Array(i);
    }

    const insertSlot = (
      index: number,
      reference: Slot<TKey, TValue> | undefined,
    ) => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = context.resolveBinding(newValues[index]!, part);
      const slot: Slot<TKey, TValue> = {
        key: newKeys[index]!,
        sentinelNode: document.createComment(''),
        binding,
      };
      newSlots[index] = slot;
      newActions.push({
        type: ActionType.Mount,
        slot,
        reference,
      });
    };
    const updateSlot = (slot: Slot<TKey, TValue>, index: number) => {
      slot.binding = context.reconcileBinding(slot.binding, newValues[index]!);
      newSlots[index] = slot;
      newActions.push({
        type: ActionType.Update,
        slot,
      });
    };
    const moveSlot = (
      slot: Slot<TKey, TValue>,
      reference: Slot<TKey, TValue> | undefined,
      index: number,
    ) => {
      slot.binding = context.reconcileBinding(slot.binding, newValues[index]!);
      newSlots[index] = slot;
      newActions.push({
        type: ActionType.Move,
        slot,
        reference,
      });
    };
    const removeSlot = (slot: Slot<TKey, TValue>) => {
      slot.binding.unbind(context);
      newActions.push({
        type: ActionType.Unmount,
        slot,
      });
    };

    let oldHead = 0;
    let oldTail = oldSlots.length - 1;
    let newHead = 0;
    let newTail = newKeys.length - 1;

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
          moveSlot(oldSlots[oldHead]!, newSlots[newTail + 1], newTail);
          newTail--;
          oldHead++;
          break;
        case oldSlots[oldTail]!.key === newKeys[newHead]:
          moveSlot(oldSlots[oldTail]!, oldSlots[oldHead]!, newHead);
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
              moveSlot(oldSlots[oldIndex]!, newSlots[newTail + 1], newTail);
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

    this._pendingActions = newActions;
    this._pendingSlots = newSlots;
  }
}

function commitMount<TKey, TValue>(
  { binding, sentinelNode, key }: Slot<TKey, TValue>,
  referenceNode: ChildNode,
  context: EffectContext,
): void {
  referenceNode.before(sentinelNode, binding.part.node);
  DEBUG: {
    sentinelNode.nodeValue = `${inspectValue(key)}: ${inspectValue(binding.value)})>`;
    binding.part.node.nodeValue = `${inspectValue(key)}: END`;
  }
  binding.commit(context);
}

function commitMove<TKey, TValue>(
  { binding, sentinelNode }: Slot<TKey, TValue>,
  referenceNode: ChildNode,
  context: EffectContext,
): void {
  const parentNode = sentinelNode.parentNode;
  if (parentNode !== null) {
    const insertOrMoveBefore =
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;
    const childNodes = selectChildNodes(sentinelNode, binding.part.node);
    for (let i = 0, l = childNodes.length; i < l; i++) {
      insertOrMoveBefore.call(parentNode, childNodes[i]!, referenceNode);
    }
  }
  binding.commit(context);
}

function commitUnmount<TKey, TValue>(
  { binding, sentinelNode }: Slot<TKey, TValue>,
  context: EffectContext,
): void {
  binding.commit(context);
  binding.part.node.remove();
  sentinelNode.remove();
}

function commitUpdate<TKey, TValue>(
  { binding, sentinelNode, key }: Slot<TKey, TValue>,
  context: EffectContext,
): void {
  DEBUG: {
    sentinelNode.nodeValue = `${inspectValue(key)}: ${inspectValue(binding.value)})>`;
    binding.part.node.nodeValue = `${inspectValue(key)}: END`;
  }
  binding.commit(context);
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
