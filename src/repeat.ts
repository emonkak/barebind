/// <reference path="../typings/moveBefore.d.ts" />

import { DirectiveSpecifier, ensurePartType } from './directive.js';
import { replaceMarkerNode } from './hydration.js';
import {
  type Binding,
  type DirectiveContext,
  type DirectiveType,
  getHydrationTargetTree,
  getStartNode,
  type Part,
  PartType,
  type Slot,
  type UpdateSession,
} from './internal.js';
import { reconcileChildren } from './reconciliation.js';

const OPERATION_INSERT = 0;
const OPERATION_MOVE = 1;
const OPERATION_MOVE_AND_UPDATE = 2;
const OPERATION_UPDATE = 3;
const OPERATION_REMOVE = 4;

export type RepeatProps<TSource, TKey = unknown, TValue = unknown> = {
  items: Iterable<TSource>;
  keySelector?: (element: TSource, index: number) => TKey;
  valueSelector?: (element: TSource, index: number) => TValue;
};

interface Operation<T> {
  type:
    | typeof OPERATION_INSERT
    | typeof OPERATION_MOVE
    | typeof OPERATION_MOVE_AND_UPDATE
    | typeof OPERATION_UPDATE
    | typeof OPERATION_REMOVE;
  slot: Slot<T>;
  referenceSlot?: Slot<T> | undefined;
}

export function Repeat<TSource, TKey, TValue>(
  props: RepeatProps<TSource, TKey, TValue>,
): DirectiveSpecifier<RepeatProps<TSource, TKey, TValue>> {
  return new DirectiveSpecifier(RepeatDirective, props);
}

export const RepeatDirective: DirectiveType<RepeatProps<any, any, any>> = {
  name: 'RepeatDirective',
  resolveBinding(
    props: RepeatProps<unknown, unknown, unknown>,
    part: Part,
    _context: DirectiveContext,
  ): RepeatBinding<unknown, unknown, unknown> {
    ensurePartType<Part.ChildNodePart>(PartType.ChildNode, this, props, part);
    return new RepeatBinding(props, part);
  },
};

export class RepeatBinding<TSource, TKey, TValue>
  implements Binding<RepeatProps<TSource, TKey, TValue>>
{
  private _props: RepeatProps<TSource, TKey, TValue>;

  private readonly _part: Part.ChildNodePart;

  private _pendingKeys: TKey[] = [];

  private _pendingSlots: Slot<TValue>[] = [];

  private _pendingOperations: Operation<TValue>[] = [];

  private _memoizedSlots: Slot<TValue>[] | null = null;

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
      props.items !== this._props.items ||
      props.keySelector !== this._props.keySelector ||
      props.valueSelector !== this._props.valueSelector
    );
  }

  attach(session: UpdateSession): void {
    const { context, originScope } = session;
    const document = this._part.node.ownerDocument;
    const targetTree = getHydrationTargetTree(originScope);

    const {
      items,
      keySelector = defaultKeySelector,
      valueSelector = defaultValueSelector,
    } = this._props;
    const oldKeys = this._pendingKeys;
    const oldSlots = this._pendingSlots;
    const newItems = Array.isArray(items) ? items : Array.from(items);
    const newKeys = newItems.map(keySelector);
    const newValues = newItems.map(valueSelector);
    const newSlots = reconcileChildren(oldKeys, oldSlots, newKeys, newValues, {
      insert: (source, referenceSlot) => {
        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: this._part.namespaceURI,
        };
        const slot = context.resolveSlot(source, part);
        slot.attach(session);
        if (targetTree !== null) {
          replaceMarkerNode(targetTree, part.node);
        } else {
          this._pendingOperations.push({
            type: OPERATION_INSERT,
            slot,
            referenceSlot,
          });
        }
        return slot;
      },
      update: (slot, source) => {
        if (slot.reconcile(source, session)) {
          this._pendingOperations.push({
            type: OPERATION_UPDATE,
            slot,
          });
        }
        return slot;
      },
      move: (slot, source, referenceSlot) => {
        if (slot.reconcile(source, session)) {
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

    this._pendingKeys = newKeys;
    this._pendingSlots = newSlots;

    if (targetTree !== null) {
      this._part.anchorNode = getAnchorNode(newSlots);
      this._memoizedSlots = newSlots;
    }
  }

  detach(session: UpdateSession): void {
    for (const slot of this._pendingSlots) {
      slot.detach(session);
    }
  }

  commit(): void {
    for (const { type, slot, referenceSlot } of this._pendingOperations) {
      switch (type) {
        case OPERATION_INSERT:
          insertSlot(slot, referenceSlot, this._part);
          slot.commit();
          break;
        case OPERATION_MOVE:
          moveSlot(slot, referenceSlot, this._part);
          break;
        case OPERATION_MOVE_AND_UPDATE:
          moveSlot(slot, referenceSlot, this._part);
          slot.commit();
          break;
        case OPERATION_UPDATE:
          slot.commit();
          break;
        case OPERATION_REMOVE:
          slot.rollback();
          slot.part.node.remove();
          break;
      }
    }

    this._part.anchorNode = getAnchorNode(this._pendingSlots);
    this._pendingOperations = [];
    this._memoizedSlots = this._pendingSlots;
  }

  rollback(): void {
    if (this._memoizedSlots !== null) {
      for (const slot of this._memoizedSlots) {
        slot.rollback();
        slot.part.node.remove();
      }
    }

    this._part.anchorNode = null;
    this._pendingOperations = this._pendingSlots.map((slot) => ({
      type: OPERATION_INSERT,
      slot,
    }));
    this._memoizedSlots = null;
  }
}

function defaultKeySelector(_element: any, index: number): any {
  return index;
}

function defaultValueSelector(element: any): any {
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

    for (const sibling of siblings) {
      insertOrMoveBefore.call(parentNode, sibling, referenceNode);
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
