import {
  type Directive,
  type DirectiveHandler,
  type Scope,
  type Session,
  wrap,
} from '../core.js';
import { Slot } from '../slot.js';
import {
  type DOMPart,
  insertChildNodePart,
  moveChildNodePart,
} from './part.js';
import type { DOMRenderer } from './renderer.js';

const InsertType = 0;
const UpdateType = 1;
const UpdateAndMoveType = 2;
const RemoveType = 3;

interface Mutation {
  type:
    | typeof InsertType
    | typeof UpdateType
    | typeof UpdateAndMoveType
    | typeof RemoveType;
  slot: Slot<DOMPart.ChildNodePart>;
  refSlot?: Slot<DOMPart.ChildNodePart> | undefined;
}

interface ReconciliationResult {
  mutations: Mutation[];
  slots: Slot<DOMPart.ChildNodePart>[];
}

export class DOMRepeatHandler<TSource>
  implements
    DirectiveHandler<Iterable<TSource>, DOMPart.ChildNodePart, DOMRenderer>
{
  private _pendingMutations: Mutation[] = [];

  private _pendingSlots: Slot<DOMPart.ChildNodePart>[] = [];

  private _currentSlots: Slot<DOMPart.ChildNodePart>[] = [];

  shouldUpdate(
    newSource: Iterable<TSource>,
    oldSource: Iterable<TSource>,
  ): boolean {
    return newSource !== oldSource;
  }

  render(
    source: Iterable<TSource>,
    _part: DOMPart.ChildNodePart,
    scope: Scope.ChildScope<DOMPart.ChildNodePart, DOMRenderer>,
    session: Session<DOMPart.ChildNodePart, DOMRenderer>,
  ): Iterable<Slot> {
    const { mutations, slots } = reconcileDirectives(
      this._currentSlots,
      Array.from(source, wrap),
      scope,
      session,
    );

    this._pendingMutations = mutations;
    this._pendingSlots = slots;

    return slots;
  }

  complete(
    _source: Iterable<TSource>,
    _part: DOMPart.ChildNodePart,
    _scope: Scope<DOMPart.ChildNodePart, DOMRenderer>,
    _session: Session<DOMPart.ChildNodePart, DOMRenderer>,
  ): void {}

  discard(
    _source: Iterable<TSource>,
    _part: DOMPart.ChildNodePart,
    _scope: Scope<DOMPart.ChildNodePart, DOMRenderer>,
    session: Session<DOMPart.ChildNodePart, DOMRenderer>,
  ): void {
    for (const slot of this._currentSlots) {
      slot.discard(session);
    }

    this._pendingMutations = [];
    this._pendingSlots = [];
  }

  mount(
    _newSource: Iterable<TSource>,
    _oldSource: Iterable<TSource> | null,
    part: DOMPart.ChildNodePart,
  ): void {
    for (const { type, slot, refSlot } of this._pendingMutations.splice(0)) {
      switch (type) {
        case InsertType:
          insertChildNodePart(part, slot.part, refSlot?.part);
          slot.commit();
          break;
        case UpdateType:
          slot.commit();
          break;
        case UpdateAndMoveType:
          moveChildNodePart(part, slot.part, refSlot?.part);
          slot.commit();
          break;
        case RemoveType:
          slot.revert();
          slot.part.sentinelNode.remove();
          break;
      }
    }

    part.node = this._pendingSlots[0]?.part.node ?? part.sentinelNode;
    this._currentSlots = this._pendingSlots;
  }

  unmount(_source: Iterable<TSource>, part: DOMPart.ChildNodePart): void {
    for (const slot of this._currentSlots) {
      slot.revert();
      slot.part.sentinelNode.remove();
    }

    part.node = part.sentinelNode;
    this._currentSlots = [];
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

function reconcileDirectives(
  slots: Slot<DOMPart.ChildNodePart, DOMRenderer>[],
  directives: Directive.ElementDirective[],
  scope: Scope.ChildScope<DOMPart.ChildNodePart, DOMRenderer>,
  session: Session<DOMPart.ChildNodePart, DOMRenderer>,
): ReconciliationResult {
  const oldKeys = slots.map((slot, index) => slot.directive.key ?? index);
  const oldSlots: (Slot<DOMPart.ChildNodePart> | undefined)[] = slots.slice();
  const newKeys = directives.map((node, index) => node.key ?? index);
  const newMutations: Mutation[] = [];
  const newSlots: Slot<DOMPart.ChildNodePart>[] = new Array(directives.length);

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
          oldSlot.discard(session);
          newMutations.push({
            type: RemoveType,
            slot: oldSlot,
          });
        }
        oldHead++;
      }
      break;
    } else if (oldHead > oldTail) {
      while (newHead <= newTail) {
        const newSlot = new Slot(
          session.renderer.renderChildNodePart(),
          wrap(directives[newHead]!),
          scope,
        );
        newMutations.push({
          type: InsertType,
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
      const headSlot = oldSlots[oldHead]!.update(directives[newHead]!, scope);
      newMutations.push({
        type: UpdateType,
        slot: headSlot,
      });
      newSlots[newHead] = headSlot;
      oldHead++;
      newHead++;
    } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
      const tailSlot = oldSlots[oldTail]!.update(directives[newTail]!, scope);
      newMutations.push({
        type: UpdateType,
        slot: tailSlot,
      });
      newSlots[newTail] = tailSlot;
      oldTail--;
      newTail--;
    } else if (
      Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
      Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
    ) {
      const headSlot = oldSlots[oldHead]!.update(directives[newHead]!, scope);
      const tailSlot = oldSlots[oldTail]!.update(directives[newTail]!, scope);
      newMutations.push({
        type: UpdateAndMoveType,
        slot: tailSlot,
        refSlot: oldSlots[oldHead],
      });
      newMutations.push({
        type: UpdateAndMoveType,
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
        headSlot.discard(session);
        newMutations.push({
          type: RemoveType,
          slot: headSlot,
        });
        oldHead++;
      } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
        const tailSlot = oldSlots[oldTail]!;
        tailSlot.discard(session);
        newMutations.push({
          type: RemoveType,
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
          const slot = oldSlots[oldIndex]!.update(directives[newTail]!, scope);
          newMutations.push({
            type: UpdateAndMoveType,
            slot,
            refSlot: newSlots[newTail + 1],
          });
          newSlots[newTail] = slot;
          oldSlots[oldIndex] = undefined;
        } else {
          const newSlot = new Slot(
            session.renderer.renderChildNodePart(),
            wrap(directives[newTail]),
            scope,
          );
          newMutations.push({
            type: InsertType,
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
