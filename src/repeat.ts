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
import { reconcileProjections } from './reconciliation.js';

const MUTATION_TYPE_INSERT = 0;
const MUTATION_TYPE_MOVE = 1;
const MUTATION_TYPE_MOVE_AND_UPDATE = 2;
const MUTATION_TYPE_UPDATE = 3;
const MUTATION_TYPE_REMOVE = 4;

export type RepeatProps<TSource, TKey = unknown, TElement = unknown> = {
  elementSelector?: (source: TSource, index: number) => TElement;
  keySelector?: (source: TSource, index: number) => TKey;
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
    ensurePartType<Part.ChildNodePart>(PartType.ChildNode, this, props, part);
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
    const { context, originScope } = session;
    const document = this._part.node.ownerDocument;
    const targetTree = getHydrationTargetTree(originScope);

    const {
      source,
      keySelector = defaultKeySelector,
      elementSelector = defaultElementSelector,
    } = this._props;
    const oldKeys = this._pendingKeys;
    const oldSlots = this._pendingSlots;
    const newSources = Array.isArray(source)
      ? (source as TSource[])
      : Array.from(source);
    const newKeys = newSources.map(keySelector);
    const newElements = newSources.map(elementSelector);
    const newSlots = reconcileProjections(
      oldKeys,
      oldSlots,
      newKeys,
      newElements,
      {
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
          }
          this._pendingMutations.push({
            type: MUTATION_TYPE_INSERT,
            slot,
            referenceSlot,
          });
          return slot;
        },
        update: (slot, source) => {
          if (slot.reconcile(source, session)) {
            this._pendingMutations.push({
              type: MUTATION_TYPE_UPDATE,
              slot,
            });
          }
          return slot;
        },
        move: (slot, source, referenceSlot) => {
          const type = slot.reconcile(source, session)
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
          slot.part.node.remove();
          break;
      }
    }

    this._part.anchorNode = getAnchorNode(this._pendingSlots);
    this._pendingMutations = [];
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
    this._pendingMutations = this._pendingSlots.map((slot) => ({
      type: MUTATION_TYPE_INSERT,
      slot,
    }));
    this._memoizedSlots = null;
  }
}

function defaultElementSelector<TElement>(source: unknown): TElement {
  return source as TElement;
}

function defaultKeySelector<TKey>(_source: unknown, index: number): TKey {
  return index as TKey;
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
