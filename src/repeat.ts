/// <reference path="../typings/moveBefore.d.ts" />

import { DirectiveError, DirectiveSpecifier } from './directive.js';
import { replaceMarkerNode } from './hydration.js';
import {
  type Binding,
  type DirectiveContext,
  type DirectiveType,
  getStartNode,
  type Part,
  PartType,
  type Slot,
  type UpdateSession,
} from './internal.js';
import { getHydrationTreeWalker } from './scope.js';

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

type Operation<T> =
  | {
      type: typeof OPERATION_INSERT;
      slot: Slot<T>;
      referenceSlot: Slot<T> | undefined;
    }
  | {
      type: typeof OPERATION_MOVE;
      slot: Slot<T>;
      referenceSlot: Slot<T> | undefined;
    }
  | {
      type: typeof OPERATION_MOVE_AND_UPDATE;
      slot: Slot<T>;
      referenceSlot: Slot<T> | undefined;
    }
  | { type: typeof OPERATION_UPDATE; slot: Slot<T> }
  | { type: typeof OPERATION_REMOVE; slot: Slot<T> };

interface ReconciliationHandler<T> {
  insert(value: T, referenceSlot: Slot<T> | undefined): Slot<T>;
  update(slot: Slot<T>, newValue: T): Slot<T>;
  move(slot: Slot<T>, newValue: T, referenceSlot: Slot<T> | undefined): Slot<T>;
  remove(slot: Slot<T>): void;
}

export function Repeat<TSource, TKey, TValue>(
  props: RepeatProps<TSource, TKey, TValue>,
): DirectiveSpecifier<RepeatProps<TSource, TKey, TValue>> {
  return new DirectiveSpecifier(RepeatDirective, props);
}

export const RepeatDirective: DirectiveType<RepeatProps<any, any, any>> = {
  displayName: 'RepeatDirective',
  resolveBinding(
    props: RepeatProps<unknown, unknown, unknown>,
    part: Part,
    _context: DirectiveContext,
  ): RepeatBinding<unknown, unknown, unknown> {
    if (part.type !== PartType.ChildNode) {
      throw new DirectiveError(
        this,
        props,
        part,
        'RepeatDirective must be used in a child part.',
      );
    }
    return new RepeatBinding(props, part);
  },
};

export class RepeatBinding<TSource, TKey, TValue>
  implements Binding<RepeatProps<TSource, TKey, TValue>>
{
  private _props: RepeatProps<TSource, TKey, TValue>;

  private readonly _part: Part.ChildNodePart;

  private _latestKeys: TKey[] = [];

  private _pendingSlots: Slot<TValue>[] = [];

  private _memoizedSlots: Slot<TValue>[] | null = null;

  private _pendingOperations: Operation<TValue>[] = [];

  constructor(
    props: RepeatProps<TSource, TKey, TValue>,
    part: Part.ChildNodePart,
  ) {
    this._props = props;
    this._part = part;
  }

  get type(): DirectiveType<RepeatProps<TSource, TKey, TValue>> {
    return RepeatDirective;
  }

  get value(): RepeatProps<TSource, TKey, TValue> {
    return this._props;
  }

  set value(props: RepeatProps<TSource, TKey, TValue>) {
    this._props = props;
  }

  get part(): Part.ChildNodePart {
    return this._part;
  }

  shouldUpdate(props: RepeatProps<TSource, TKey, TValue>): boolean {
    return (
      this._memoizedSlots === null ||
      props.source !== this._props.source ||
      props.keySelector !== this._props.keySelector ||
      props.valueSelector !== this._props.valueSelector
    );
  }

  attach(session: UpdateSession): void {
    const { context, rootScope } = session;
    const document = this._part.node.ownerDocument;
    const treeWalker = getHydrationTreeWalker(rootScope);

    const {
      source,
      keySelector = defaultKeySelector,
      valueSelector = defaultValueSelector,
    } = this._props;
    const oldKeys = this._latestKeys;
    const oldSlots = this._pendingSlots;
    let newKeys: TKey[];
    let newValues: TValue[];

    if (Array.isArray(source)) {
      newKeys = new Array(source.length);
      newValues = new Array(source.length);
      for (let i = 0, l = source.length; i < l; i++) {
        const item = source[i]!;
        newKeys[i] = keySelector(item, i);
        newValues[i] = valueSelector(item, i);
      }
    } else {
      let i = 0;
      newKeys = [];
      newValues = [];
      for (const item of source) {
        newKeys.push(keySelector(item, i));
        newValues.push(valueSelector(item, i));
        i++;
      }
    }

    const newSlots = reconcileSlots(oldKeys, oldSlots, newKeys, newValues, {
      insert: (newValue, referenceSlot) => {
        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: this._part.namespaceURI,
        };
        const slot = context.resolveSlot(newValue, part);
        slot.attach(session);
        if (treeWalker !== null) {
          replaceMarkerNode(treeWalker, part.node);
        } else {
          this._pendingOperations.push({
            type: OPERATION_INSERT,
            slot,
            referenceSlot,
          });
        }
        return slot;
      },
      update: (slot, newValue) => {
        if (slot.reconcile(newValue, session)) {
          this._pendingOperations.push({
            type: OPERATION_UPDATE,
            slot,
          });
        }
        return slot;
      },
      move: (slot, newValue, referenceSlot) => {
        if (slot.reconcile(newValue, session)) {
          this._pendingOperations.push({
            type: OPERATION_MOVE_AND_UPDATE,
            slot,
            referenceSlot,
          });
        } else {
          this._pendingOperations.push({
            type: OPERATION_MOVE,
            slot,
            referenceSlot,
          });
        }
        return slot;
      },
      remove: (slot) => {
        slot.detach(session);
        this._pendingOperations.push({
          type: OPERATION_REMOVE,
          slot,
        });
      },
    });

    this._latestKeys = newKeys;
    this._pendingSlots = newSlots;

    if (treeWalker !== null) {
      this._part.anchorNode = getAnchorNode(newSlots);
      this._memoizedSlots = newSlots;
    }
  }

  detach(session: UpdateSession): void {
    for (let i = this._pendingSlots.length - 1; i >= 0; i--) {
      this._pendingSlots[i]!.detach(session);
    }
  }

  commit(): void {
    for (let i = 0, l = this._pendingOperations.length; i < l; i++) {
      const operation = this._pendingOperations[i]!;
      switch (operation.type) {
        case OPERATION_INSERT: {
          const { slot, referenceSlot } = operation;
          insertSlot(slot, referenceSlot, this._part);
          slot.commit();
          break;
        }
        case OPERATION_MOVE: {
          const { slot, referenceSlot } = operation;
          moveSlot(slot, referenceSlot, this._part);
          break;
        }
        case OPERATION_MOVE_AND_UPDATE: {
          const { slot, referenceSlot } = operation;
          moveSlot(slot, referenceSlot, this._part);
          slot.commit();
          break;
        }
        case OPERATION_UPDATE: {
          const { slot } = operation;
          slot.commit();
          break;
        }
        case OPERATION_REMOVE: {
          const { slot } = operation;
          slot.rollback();
          slot.part.node.remove();
          break;
        }
      }
    }

    this._part.anchorNode = getAnchorNode(this._pendingSlots);
    this._memoizedSlots = this._pendingSlots;
    this._pendingOperations = [];
  }

  rollback(): void {
    if (this._memoizedSlots !== null) {
      for (let i = this._memoizedSlots.length - 1; i >= 0; i--) {
        const slot = this._memoizedSlots[i]!;
        slot.rollback();
        slot.part.node.remove();
      }
    }

    this._part.anchorNode = null;

    this._latestKeys = [];
    this._pendingSlots = [];
    this._memoizedSlots = null;
    this._pendingOperations = [];
  }
}

function buildKeyToIndexMap<T>(
  keys: T[],
  head: number,
  tail: number,
): Map<T, number> {
  const keyToIndexMap = new Map();
  for (let i = head; i <= tail; i++) {
    keyToIndexMap.set(keys[i]!, i);
  }
  return keyToIndexMap;
}

function defaultKeySelector(_element: unknown, index: number): any {
  return index;
}

function defaultValueSelector(element: unknown): any {
  return element;
}

function getAnchorNode<T>(slots: Slot<T>[]): ChildNode | null {
  return slots.length > 0 ? getStartNode(slots[0]!.part) : null;
}

function getSiblings(startNode: ChildNode, endNode: ChildNode): ChildNode[] {
  const siblings = [startNode];
  let currentNode: ChildNode | null = startNode;

  while (currentNode !== endNode && currentNode.nextSibling !== null) {
    currentNode = currentNode.nextSibling;
    siblings.push(currentNode);
  }

  return siblings;
}

function insertSlot<T>(
  slot: Slot<T>,
  referenceSlot: Slot<T> | undefined,
  part: Part,
): void {
  const referenceNode =
    referenceSlot !== undefined ? getStartNode(referenceSlot.part) : part.node;
  referenceNode.before(slot.part.node);
}

function moveSiblings(siblings: ChildNode[], referenceNode: ChildNode): void {
  const { parentNode } = referenceNode;

  if (parentNode !== null) {
    const insertOrMoveBefore =
      /* v8 ignore next */
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;

    for (let i = 0, l = siblings.length; i < l; i++) {
      insertOrMoveBefore.call(parentNode, siblings[i]!, referenceNode);
    }
  }
}

function moveSlot<T>(
  slot: Slot<T>,
  referenceSlot: Slot<T> | undefined,
  part: Part,
): void {
  const startNode = getStartNode(slot.part);
  const endNode = slot.part.node;
  const siblings = getSiblings(startNode, endNode);
  const referenceNode =
    referenceSlot !== undefined ? getStartNode(referenceSlot.part) : part.node;
  moveSiblings(siblings, referenceNode);
}

function reconcileSlots<TKey, TValue>(
  oldKeys: TKey[],
  oldSlots: (Slot<TValue> | undefined)[],
  newKeys: TKey[],
  newValues: TValue[],
  handler: ReconciliationHandler<TValue>,
): Slot<TValue>[] {
  const newSlots: Slot<TValue>[] = new Array(newKeys.length);

  let newHead = 0;
  let newTail = newKeys.length - 1;
  let oldHead = 0;
  let oldTail = oldKeys.length - 1;

  let newKeyToIndexMap: Map<TKey, number> | undefined;
  let oldKeyToIndexMap: Map<TKey, number> | undefined;

  while (true) {
    if (newHead > newTail) {
      while (oldHead <= oldTail) {
        const oldSlot = oldSlots[oldTail];
        if (oldSlot !== undefined) {
          handler.remove(oldSlot);
        }
        oldTail--;
      }
      break;
    } else if (oldHead > oldTail) {
      while (newHead <= newTail) {
        newSlots[newHead] = handler.insert(
          newValues[newHead]!,
          newSlots[newTail + 1],
        );
        newHead++;
      }
      break;
    } else if (oldSlots[oldHead] === undefined) {
      oldHead++;
    } else if (oldSlots[oldTail] === undefined) {
      oldTail--;
    } else if (Object.is(oldKeys[oldHead]!, newKeys[newHead]!)) {
      newSlots[newHead] = handler.update(
        oldSlots[oldHead]!,
        newValues[newHead]!,
      );
      newHead++;
      oldHead++;
    } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
      newSlots[newTail] = handler.update(
        oldSlots[oldTail]!,
        newValues[newTail]!,
      );
      newTail--;
      oldTail--;
    } else if (Object.is(oldKeys[oldHead]!, newKeys[newTail]!)) {
      newSlots[newTail] = handler.move(
        oldSlots[oldHead]!,
        newValues[newTail]!,
        newSlots[newTail + 1],
      );
      newTail--;
      oldHead++;
    } else if (Object.is(oldKeys[oldTail]!, newKeys[newHead]!)) {
      newSlots[newHead] = handler.move(
        oldSlots[oldTail]!,
        newValues[newHead]!,
        oldSlots[oldHead],
      );
      newHead++;
      oldTail--;
    } else {
      newKeyToIndexMap ??= buildKeyToIndexMap(newKeys, newHead, newTail);

      if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
        handler.remove(oldSlots[oldHead]!);
        oldHead++;
      } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
        handler.remove(oldSlots[oldTail]!);
        oldTail--;
      } else {
        oldKeyToIndexMap ??= buildKeyToIndexMap(oldKeys, oldHead, oldTail);

        const newKey = newKeys[newTail]!;
        const newValue = newValues[newTail]!;
        const oldIndex = oldKeyToIndexMap.get(newKey);

        if (oldIndex !== undefined && oldSlots[oldIndex] !== undefined) {
          newSlots[newTail] = handler.move(
            oldSlots[oldIndex],
            newValue,
            newSlots[newTail + 1],
          );
          oldSlots[oldIndex] = undefined;
        } else {
          newSlots[newTail] = handler.insert(newValue, newSlots[newTail + 1]);
        }

        newTail--;
      }
    }
  }

  return newSlots;
}
