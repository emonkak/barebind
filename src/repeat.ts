/// <reference path="../typings/moveBefore.d.ts" />

import {
  type Binding,
  Directive,
  type DirectiveContext,
  type DirectiveType,
  PART_TYPE_CHILD_NODE,
  type Part,
  type Session,
} from './core.js';
import { getHydrationTarget, replaceSentinelNode } from './hydration.js';
import { createChildNodePart, ensurePartType } from './part.js';
import { reconcileItems } from './reconciliation.js';
import { Slot } from './slot.js';

const MUTATION_TYPE_INSERT = 0;
const MUTATION_TYPE_UPDATE = 1;
const MUTATION_TYPE_UPDATE_AND_MOVE = 2;
const MUTATION_TYPE_REMOVE = 3;

export type RepeatProps<TSource, TKey = unknown, TElement = unknown> = {
  elementSelector?: (item: TSource, index: number) => TElement;
  keySelector?: (item: TSource, index: number) => TKey;
  source: Iterable<TSource>;
};

interface Mutation<T> {
  type:
    | typeof MUTATION_TYPE_INSERT
    | typeof MUTATION_TYPE_UPDATE
    | typeof MUTATION_TYPE_UPDATE_AND_MOVE
    | typeof MUTATION_TYPE_REMOVE;
  slot: Slot<T>;
  referenceSlot?: Slot<T> | undefined;
}

export function Repeat<TSource, TKey, TElement>(
  props: RepeatProps<TSource, TKey, TElement>,
): Directive<RepeatProps<TSource, TKey, TElement>> {
  return new Directive<RepeatProps<TSource, TKey, TElement>>(Repeat, props);
}

Repeat.resolveBinding = function <TSource, TKey, TElement>(
  props: RepeatProps<TSource, TKey, TElement>,
  part: Part,
  _context: DirectiveContext,
): RepeatBinding<TSource, TKey, TElement> {
  ensurePartType(PART_TYPE_CHILD_NODE, this, props, part);
  return new RepeatBinding(props, part);
};

export class RepeatBinding<TSource, TKey, TElement>
  implements Binding<RepeatProps<TSource, TKey, TElement>>
{
  private _props: RepeatProps<TSource, TKey, TElement>;

  private readonly _part: Part.ChildNodePart;

  private _pendingKeys: TKey[] = [];

  private _pendingSlots: Slot<TElement>[] = [];

  private _pendingMutations: Mutation<TElement>[] = [];

  private _currentKeys: TKey[] | null = null;

  private _currentSlots: Slot<TElement>[] | null = null;

  constructor(
    props: RepeatProps<TSource, TKey, TElement>,
    part: Part.ChildNodePart,
  ) {
    this._props = props;
    this._part = part;
  }

  get type(): DirectiveType<RepeatProps<TSource, TKey, TElement>> {
    return Repeat;
  }

  get value(): RepeatProps<TSource, TKey, TElement> {
    return this._props;
  }

  set value(props: RepeatProps<TSource, TKey, TElement>) {
    this._props = props;
  }

  get part(): Part.ChildNodePart {
    return this._part;
  }

  shouldUpdate(props: RepeatProps<TSource, TKey, TElement>): boolean {
    return (
      this._currentSlots === null ||
      props.source !== this._props.source ||
      props.keySelector !== this._props.keySelector ||
      props.elementSelector !== this._props.elementSelector
    );
  }

  attach(session: Session): void {
    const { context, coroutine } = session;
    const hydrationTarget = getHydrationTarget(coroutine.scope);

    const {
      source,
      keySelector = defaultKeySelector,
      elementSelector = defaultElementSelector,
    } = this._props;
    const oldKeys = this._currentKeys ?? [];
    const oldSlots = this._currentSlots ?? [];
    const newItems = Array.isArray(source)
      ? (source as TSource[])
      : Array.from(source);
    const newKeys = newItems.map(keySelector);
    const newElements = newItems.map(elementSelector);
    const newSlots = reconcileItems(oldKeys, newKeys, oldSlots, newElements, {
      insert: (item, referenceSlot) => {
        const { sentinelNode, namespaceURI } = this._part;
        const part = createChildNodePart(
          sentinelNode.ownerDocument.createComment(''),
          namespaceURI,
        );
        const slot = Slot.place(item, part, context);
        slot.attach(session);
        if (hydrationTarget !== null) {
          replaceSentinelNode(hydrationTarget, part.sentinelNode);
        }
        this._pendingMutations.push({
          type: MUTATION_TYPE_INSERT,
          slot,
          referenceSlot,
        });
        return slot;
      },
      update: (slot, item) => {
        if (slot.reconcile(item, session)) {
          this._pendingMutations.push({
            type: MUTATION_TYPE_UPDATE,
            slot,
          });
        }
        return slot;
      },
      updateAndMove: (slot, item, referenceSlot) => {
        slot.reconcile(item, session);
        this._pendingMutations.push({
          type: MUTATION_TYPE_UPDATE_AND_MOVE,
          slot,
          referenceSlot,
        });
        return slot;
      },
      remove: (slot) => {
        slot.detach(session);
        this._pendingMutations.push({
          type: MUTATION_TYPE_REMOVE,
          slot,
        });
      },
    });

    this._pendingKeys = newKeys;
    this._pendingSlots = newSlots;
  }

  detach(session: Session): void {
    if (this._currentSlots !== null) {
      for (const slot of this._currentSlots) {
        slot.detach(session);
      }
    }
  }

  commit(): void {
    for (const { type, slot, referenceSlot } of this._pendingMutations) {
      switch (type) {
        case MUTATION_TYPE_INSERT:
          insertSlot(slot, referenceSlot, this._part);
          slot.commit();
          break;
        case MUTATION_TYPE_UPDATE:
          slot.commit();
          break;
        case MUTATION_TYPE_UPDATE_AND_MOVE:
          moveSlot(slot, referenceSlot, this._part);
          slot.commit();
          break;
        case MUTATION_TYPE_REMOVE:
          slot.rollback();
          (slot.part as Part.ChildNodePart).sentinelNode.remove();
          break;
      }
    }

    this._part.node =
      this._pendingSlots[0]?.part.node ?? this._part.sentinelNode;
    this._pendingMutations = [];
    this._currentKeys = this._pendingKeys;
    this._currentSlots = this._pendingSlots;
  }

  rollback(): void {
    if (this._currentSlots !== null) {
      for (const slot of this._currentSlots) {
        slot.rollback();
        (slot.part as Part.ChildNodePart).sentinelNode.remove();
      }
    }

    this._part.node = this._part.sentinelNode;
    this._pendingMutations = [];
    this._currentKeys = null;
    this._currentSlots = null;
  }
}

function defaultElementSelector<TElement>(item: unknown): TElement {
  return item as TElement;
}

function defaultKeySelector<TKey>(_item: unknown, index: number): TKey {
  return index as TKey;
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
  part: Part.ChildNodePart,
): void {
  const referenceNode =
    referenceSlot !== undefined ? referenceSlot.part.node : part.sentinelNode;
  referenceNode.before((slot.part as Part.ChildNodePart).sentinelNode);
}

function moveSlot<T>(
  slot: Slot<T>,
  referenceSlot: Slot<T> | undefined,
  part: Part.ChildNodePart,
): void {
  const startNode = slot.part.node;
  const endNode = (slot.part as Part.ChildNodePart).sentinelNode;
  const siblings = getSiblings(startNode, endNode);
  const referenceNode =
    referenceSlot !== undefined ? referenceSlot.part.node : part.sentinelNode;
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
