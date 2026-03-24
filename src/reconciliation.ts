import type { Directive, Part, Session } from './core.js';
import {
  createChildNodePart,
  getHydrationTarget,
  replaceSentinelNode,
} from './dom.js';
import { Slot } from './slot.js';

export const MUTATION_TYPE_INSERT = 0;
export const MUTATION_TYPE_UPDATE = 1;
export const MUTATION_TYPE_UPDATE_AND_MOVE = 2;
export const MUTATION_TYPE_REMOVE = 3;

export interface Mutation {
  type:
    | typeof MUTATION_TYPE_INSERT
    | typeof MUTATION_TYPE_UPDATE
    | typeof MUTATION_TYPE_UPDATE_AND_MOVE
    | typeof MUTATION_TYPE_REMOVE;
  slot: Slot<Directive.Node, Part.ChildNodePart>;
  refSlot?: Slot<Directive.Node, Part.ChildNodePart> | undefined;
}

export interface ReconciliationResult {
  mutations: Mutation[];
  slots: Slot<Directive.Node, Part.ChildNodePart>[];
}

export function reconcileNodes(
  slots: Slot<Directive.Node, Part.ChildNodePart>[],
  nodes: Directive.Node[],
  part: Part.ChildNodePart,
  session: Session,
): ReconciliationResult {
  const oldKeys = slots.map((slot, index) => slot!.key ?? index);
  const oldSlots: (Slot<Directive.Node, Part.ChildNodePart> | undefined)[] =
    slots.slice();
  const newKeys = nodes.map((node, index) => node.key ?? index);
  const newMutations: Mutation[] = [];
  const newSlots: Slot<Directive.Node, Part.ChildNodePart>[] = new Array(
    nodes.length,
  );

  let oldHead = 0;
  let newHead = 0;
  let oldTail = oldKeys.length - 1;
  let newTail = newKeys.length - 1;
  let oldKeyToIndexMap: Map<unknown, number> | undefined;
  let newKeyToIndexMap: Map<unknown, number> | undefined;

  while (true) {
    if (newHead > newTail) {
      while (oldHead <= oldTail) {
        const oldSlot = oldSlots[oldHead];
        if (oldSlot !== undefined) {
          removeSlot(oldSlot, session);
          newMutations.push({
            type: MUTATION_TYPE_REMOVE,
            slot: oldSlot,
          });
        }
        oldHead++;
      }
      break;
    } else if (oldHead > oldTail) {
      while (newHead <= newTail) {
        const newSlot = insertSlot(nodes[newHead]!, part, session);
        newMutations.push({
          type: MUTATION_TYPE_INSERT,
          slot: newSlot,
          refSlot: newSlots[newTail + 1],
        });
        newSlots[newHead] = newSlot;
        newHead++;
      }
      break;
    } else if (oldSlots[oldHead] === undefined) {
      oldHead++;
    } else if (oldSlots[oldTail] === undefined) {
      oldTail--;
    } else if (Object.is(oldKeys[oldHead]!, newKeys[newHead]!)) {
      const headSlot = oldSlots[oldHead]!;
      if (updateSlot(headSlot, nodes[newHead]!, session)) {
        newMutations.push({
          type: MUTATION_TYPE_UPDATE,
          slot: headSlot,
        });
      }
      newSlots[newHead] = headSlot;
      oldHead++;
      newHead++;
    } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
      const tailSlot = oldSlots[oldTail]!;
      if (updateSlot(tailSlot, nodes[newTail]!, session)) {
        newMutations.push({
          type: MUTATION_TYPE_UPDATE,
          slot: tailSlot,
        });
      }
      newSlots[newTail] = tailSlot;
      oldTail--;
      newTail--;
    } else if (
      Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
      Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
    ) {
      const headSlot = oldSlots[oldHead]!;
      const tailSlot = oldSlots[oldTail]!;
      updateSlot(tailSlot, nodes[newHead]!, session);
      updateSlot(headSlot, nodes[newTail]!, session);
      newMutations.push({
        type: MUTATION_TYPE_UPDATE_AND_MOVE,
        slot: tailSlot,
        refSlot: oldSlots[oldHead],
      });
      newMutations.push({
        type: MUTATION_TYPE_UPDATE_AND_MOVE,
        slot: headSlot,
        refSlot: newSlots[newTail + 1],
      });
      newSlots[newHead] = tailSlot;
      newSlots[newTail] = headSlot;
      oldHead++;
      newHead++;
      oldTail--;
      newTail--;
    } else {
      newKeyToIndexMap ??= buildKeyToIndexMap(newKeys, newHead, newTail);

      if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
        const headSlot = oldSlots[oldHead]!;
        removeSlot(headSlot, session);
        newMutations.push({
          type: MUTATION_TYPE_REMOVE,
          slot: headSlot,
        });
        oldHead++;
      } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
        const tailSlot = oldSlots[oldTail]!;
        removeSlot(tailSlot, session);
        newMutations.push({
          type: MUTATION_TYPE_REMOVE,
          slot: tailSlot,
        });
        oldTail--;
      } else {
        oldKeyToIndexMap ??= buildKeyToIndexMap(oldKeys, oldHead, oldTail);
        const oldIndex = oldKeyToIndexMap.get(newKeys[newTail]!);

        if (
          oldIndex !== undefined &&
          oldIndex >= oldHead &&
          oldIndex <= oldTail &&
          oldSlots[oldIndex] !== undefined
        ) {
          const slot = oldSlots[oldIndex]!;
          updateSlot(slot, nodes[newTail]!, session);
          newMutations.push({
            type: MUTATION_TYPE_UPDATE_AND_MOVE,
            slot,
            refSlot: newSlots[newTail + 1],
          });
          newSlots[newTail] = slot;
          oldSlots[oldIndex] = undefined;
        } else {
          const newSlot = insertSlot(nodes[newTail]!, part, session);
          newMutations.push({
            type: MUTATION_TYPE_INSERT,
            slot: newSlot,
            refSlot: newSlots[newTail + 1],
          });
          newSlots[newTail] = newSlot;
        }

        newTail--;
      }
    }
  }

  return { mutations: newMutations, slots: newSlots };
}

function insertSlot(
  node: Directive.Node,
  part: Part.ChildNodePart,
  session: Session,
): Slot<Directive.Node, Part.ChildNodePart> {
  const { sentinelNode, namespaceURI } = part;
  const itemPart = createChildNodePart(
    sentinelNode.ownerDocument.createComment(''),
    namespaceURI,
  );
  const slot = Slot.place(node, itemPart, session.context);
  slot.attach(session);
  const hydrationTarget = getHydrationTarget(session.coroutine.scope);
  if (hydrationTarget !== null) {
    replaceSentinelNode(hydrationTarget, part.sentinelNode);
  }
  return slot;
}

function removeSlot(
  slot: Slot<Directive.Node, Part.ChildNodePart>,
  session: Session,
): void {
  slot.detach(session);
}

function updateSlot(
  slot: Slot<Directive.Node, Part.ChildNodePart>,
  node: Directive.Node,
  session: Session,
): boolean {
  return slot.reconcile(node, session);
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
