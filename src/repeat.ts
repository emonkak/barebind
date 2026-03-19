/// <reference path="../typings/moveBefore.d.ts" />

import {
  type Binding,
  type DirectiveContext,
  type DirectiveType,
  PART_TYPE_CHILD_NODE,
  type Part,
  type Slot,
  type UpdateSession,
} from './core.js';
import { DirectiveSpecifier, ensurePartType } from './directive.js';
import { getHydrationTarget, replaceSentinelNode } from './hydration.js';
import { createChildNodePart } from './part.js';
import { reconcileProjections } from './reconciliation.js';

const MUTATION_TYPE_INSERT = 0;
const MUTATION_TYPE_MOVE = 1;
const MUTATION_TYPE_MOVE_AND_UPDATE = 2;
const MUTATION_TYPE_UPDATE = 3;
const MUTATION_TYPE_REMOVE = 4;

export type RepeatProps<TSource, TKey = unknown, TElement = unknown> = {
  elementSelector?: (item: TSource, index: number) => TElement;
  keySelector?: (item: TSource, index: number) => TKey;
  source: Iterable<TSource>;
};

interface Mutation<T> {
  type:
    | typeof MUTATION_TYPE_INSERT
    | typeof MUTATION_TYPE_MOVE
    | typeof MUTATION_TYPE_MOVE_AND_UPDATE
    | typeof MUTATION_TYPE_UPDATE
    | typeof MUTATION_TYPE_REMOVE;
  slot: Slot<T>;
  referenceSlot?: Slot<T> | undefined;
}

export function Repeat<TSource, TKey, TElement>(
  props: RepeatProps<TSource, TKey, TElement>,
): DirectiveSpecifier<RepeatProps<TSource, TKey, TElement>> {
  return new DirectiveSpecifier(RepeatDirective, props);
}

export const RepeatDirective: DirectiveType<RepeatProps<any, any, any>> = {
  name: 'RepeatDirective',
  resolveBinding(
    props: RepeatProps<unknown, unknown, unknown>,
    part: Part,
    _context: DirectiveContext,
  ): RepeatBinding<unknown, unknown, unknown> {
    ensurePartType<Part.ChildNodePart>(PART_TYPE_CHILD_NODE, this, props, part);
    return new RepeatBinding(props, part);
  },
};

export class RepeatBinding<TSource, TKey, TElement>
  implements Binding<RepeatProps<TSource, TKey, TElement>>
{
  private _props: RepeatProps<TSource, TKey, TElement>;

  private readonly _part: Part.ChildNodePart;

  private _pendingKeys: TKey[] = [];

  private _pendingSlots: Slot<TElement>[] = [];

  private _pendingMutations: Mutation<TElement>[] = [];

  private _memoizedSlots: Slot<TElement>[] | null = null;

  constructor(
    props: RepeatProps<TSource, TKey, TElement>,
    part: Part.ChildNodePart,
  ) {
    this._props = props;
    this._part = part;
  }

  get type(): DirectiveType<RepeatProps<TSource, TKey, TElement>> {
    return RepeatDirective;
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
      this._memoizedSlots === null ||
      props.source !== this._props.source ||
      props.keySelector !== this._props.keySelector ||
      props.elementSelector !== this._props.elementSelector
    );
  }

  attach(session: UpdateSession): void {
    const { context, coroutine } = session;
    const target = getHydrationTarget(coroutine.scope);

    const {
      source,
      keySelector = defaultKeySelector,
      elementSelector = defaultElementSelector,
    } = this._props;
    const oldKeys = this._pendingKeys;
    const oldSlots = this._pendingSlots;
    const newItems = Array.isArray(source)
      ? (source as TSource[])
      : Array.from(source);
    const newKeys = newItems.map(keySelector);
    const newElements = newItems.map(elementSelector);
    const newSlots = reconcileProjections(
      oldKeys,
      newKeys,
      oldSlots,
      newElements,
      {
        insert: (item, referenceSlot) => {
          const { sentinelNode, namespaceURI } = this._part;
          const part = createChildNodePart(
            sentinelNode.ownerDocument.createComment(''),
            namespaceURI,
          );
          const slot = context.resolveSlot(item, part);
          slot.attach(session);
          if (target !== null) {
            replaceSentinelNode(target, part.sentinelNode);
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
        move: (slot, item, referenceSlot) => {
          const type = slot.reconcile(item, session)
            ? MUTATION_TYPE_MOVE_AND_UPDATE
            : MUTATION_TYPE_MOVE;
          this._pendingMutations.push({
            type,
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
      },
    );

    this._pendingKeys = newKeys;
    this._pendingSlots = newSlots;

    if (target !== null) {
      this._part.node = newSlots[0]?.part.node ?? this._part.sentinelNode;
      this._memoizedSlots = newSlots;
    }
  }

  detach(session: UpdateSession): void {
    for (const slot of this._pendingSlots) {
      slot.detach(session);
    }
  }

  commit(): void {
    for (const { type, slot, referenceSlot } of this._pendingMutations) {
      switch (type) {
        case MUTATION_TYPE_INSERT:
          insertSlot(slot, referenceSlot, this._part);
          slot.commit();
          break;
        case MUTATION_TYPE_MOVE:
          moveSlot(slot, referenceSlot, this._part);
          break;
        case MUTATION_TYPE_MOVE_AND_UPDATE:
          moveSlot(slot, referenceSlot, this._part);
          slot.commit();
          break;
        case MUTATION_TYPE_UPDATE:
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
    this._memoizedSlots = this._pendingSlots;
  }

  rollback(): void {
    if (this._memoizedSlots !== null) {
      for (const slot of this._memoizedSlots) {
        slot.rollback();
        (slot.part as Part.ChildNodePart).sentinelNode.remove();
      }
    }

    this._part.node = this._part.sentinelNode;
    this._pendingMutations = this._pendingSlots.map((slot) => ({
      type: MUTATION_TYPE_INSERT,
      slot,
    }));
    this._memoizedSlots = null;
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
