/// <reference path="../../../typings/moveBefore.d.ts" />

import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type Effect,
  type EffectContext,
  type UpdateContext,
  createDirectiveElement,
} from '../coreTypes.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';

export type ListValue<TItem, TKey, TResult> = {
  items: readonly TItem[] | Iterable<TItem>;
  keySelector: (item: TItem, index: number) => TKey;
  valueSelector: (item: TItem, index: number) => TResult;
};

type Action<TKey, TValue> =
  | {
      type: ActionType.Insert;
      slot: Slot<TKey, TValue>;
      reference: Slot<TKey, TValue> | undefined;
    }
  | { type: ActionType.Update; slot: Slot<TKey, TValue> }
  | {
      type: ActionType.Move;
      slot: Slot<TKey, TValue>;
      reference: Slot<TKey, TValue> | undefined;
    }
  | { type: ActionType.Remove; slot: Slot<TKey, TValue> };

const enum ActionType {
  Insert,
  Update,
  Move,
  Remove,
}

interface Slot<TKey, TValue> {
  pendingBinding: Binding<TValue>;
  memoizedBinding: Binding<TValue> | null;
  sentinelNode: Comment;
  key: TKey;
  dirty: boolean;
}

export function list<TItem, TKey, TValue>(
  items: readonly TItem[] | Iterable<TItem>,
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
  items: readonly TItem[] | Iterable<TItem>,
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
    return 'List';
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

  private _pendingActions: Action<TKey, TValue>[] = [];

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
    this._reconcileSlots(this._value, context);
  }

  bind(value: ListValue<TItem, TKey, TValue>, context: UpdateContext): void {
    this._reconcileSlots(value, context);
    this._value = value;
  }

  disconnect(context: UpdateContext): void {
    // Unbind slots in reverse order.
    for (let i = this._memoizedSlots.length - 1; i >= 0; i--) {
      const slot = this._memoizedSlots[i]!;
      slot.memoizedBinding?.disconnect(context);
    }
  }

  commit(context: EffectContext): void {
    for (let i = 0, l = this._pendingActions.length; i < l; i++) {
      const action = this._pendingActions[i]!;
      const { slot } = action;
      if (!slot.dirty) {
        continue;
      }
      switch (action.type) {
        case ActionType.Insert: {
          const referenceNode =
            action.reference?.sentinelNode ?? this._part.node;
          commitInsert(slot, referenceNode, context);
          break;
        }
        case ActionType.Update: {
          commitUpdate(slot, context);
          break;
        }
        case ActionType.Move: {
          const referenceNode =
            action.reference?.sentinelNode ?? this._part.node;
          commitMove(slot, referenceNode, context);
          break;
        }
        case ActionType.Remove:
          commitRemove(slot, context);
          break;
      }
      slot.dirty = false;
    }

    this._pendingActions = [];
    this._memoizedSlots = this._pendingSlots;
  }

  rollback(context: EffectContext): void {
    for (let i = 0, l = this._memoizedSlots.length; i < l; i++) {
      const slot = this._memoizedSlots[i]!;
      commitRemove(slot, context);
    }

    this._memoizedSlots = [];
  }

  private _reconcileSlots(
    { items, keySelector, valueSelector }: ListValue<TItem, TKey, TValue>,
    context: UpdateContext,
  ): void {
    const pendingActions = this._pendingActions;
    const oldSlots = this._pendingSlots;
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
        pendingBinding: binding,
        memoizedBinding: null,
        dirty: true,
      };
      newSlots[index] = slot;
      pendingActions.push({
        type: ActionType.Insert,
        slot,
        reference,
      });
    };
    const updateSlot = (slot: Slot<TKey, TValue>, index: number) => {
      slot.pendingBinding = context.reconcileBinding(
        slot.pendingBinding,
        newValues[index]!,
      );
      slot.dirty = true;
      newSlots[index] = slot;
      pendingActions.push({
        type: ActionType.Update,
        slot,
      });
    };
    const moveSlot = (
      slot: Slot<TKey, TValue>,
      reference: Slot<TKey, TValue> | undefined,
      index: number,
    ) => {
      slot.pendingBinding = context.reconcileBinding(
        slot.pendingBinding,
        newValues[index]!,
      );
      slot.dirty = true;
      newSlots[index] = slot;
      pendingActions.push({
        type: ActionType.Move,
        slot,
        reference,
      });
    };
    const removeSlot = (slot: Slot<TKey, TValue>) => {
      slot.pendingBinding.disconnect(context);
      slot.dirty = true;
      pendingActions.push({
        type: ActionType.Remove,
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

    this._pendingSlots = newSlots;
  }
}

function commitInsert<TKey, TValue>(
  slot: Slot<TKey, TValue>,
  referenceNode: ChildNode,
  context: EffectContext,
): void {
  const { pendingBinding, sentinelNode, key } = slot;
  referenceNode.before(sentinelNode, pendingBinding.part.node);
  DEBUG: {
    sentinelNode.nodeValue = inspectValue(key);
    pendingBinding.part.node.nodeValue = `${inspectValue(key)}: ${pendingBinding.directive.name}`;
  }
  pendingBinding.commit(context);
  slot.memoizedBinding = pendingBinding;
}

function commitMove<TKey, TValue>(
  slot: Slot<TKey, TValue>,
  referenceNode: ChildNode,
  context: EffectContext,
): void {
  const { pendingBinding, memoizedBinding, sentinelNode } = slot;
  const parentNode = sentinelNode.parentNode;
  if (memoizedBinding !== pendingBinding) {
    memoizedBinding?.rollback(context);
  }
  if (parentNode !== null) {
    const insertOrMoveBefore =
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;
    const childNodes = selectChildNodes(sentinelNode, pendingBinding.part.node);
    for (let i = 0, l = childNodes.length; i < l; i++) {
      insertOrMoveBefore.call(parentNode, childNodes[i]!, referenceNode);
    }
  }
  pendingBinding.commit(context);
  slot.memoizedBinding = pendingBinding;
}

function commitRemove<TKey, TValue>(
  slot: Slot<TKey, TValue>,
  context: EffectContext,
): void {
  const { memoizedBinding, sentinelNode } = slot;
  if (memoizedBinding !== null) {
    memoizedBinding.rollback(context);
    memoizedBinding.part.node.remove();
    sentinelNode.remove();
    slot.memoizedBinding = null;
  }
}

function commitUpdate<TKey, TValue>(
  slot: Slot<TKey, TValue>,
  context: EffectContext,
): void {
  const { pendingBinding, memoizedBinding, sentinelNode, key } = slot;
  if (memoizedBinding !== pendingBinding) {
    memoizedBinding?.rollback(context);
  }
  DEBUG: {
    sentinelNode.nodeValue = inspectValue(key);
    pendingBinding.part.node.nodeValue = `${inspectValue(key)}: ${pendingBinding.directive.name}`;
  }
  pendingBinding.commit(context);
  slot.memoizedBinding = pendingBinding;
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
