import { type Mountable, type Scope, type Session, wrap } from '../core.js';
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
  afterSlot?: Slot<DOMPart.ChildNodePart> | undefined;
}

export class DOMFragment<TSource>
  implements Mountable<Iterable<TSource>, DOMPart.ChildNodePart, DOMRenderer>
{
  private _pendingSlots: Slot<DOMPart.ChildNodePart>[] = [];

  private _currentSlots: Slot<DOMPart.ChildNodePart>[] = [];

  private _mutations: Mutation[] = [];

  static shouldUpdate<TSource>(
    newSource: Iterable<TSource>,
    oldSource: Iterable<TSource>,
  ): boolean {
    return newSource !== oldSource;
  }

  static render<TSource>(
    source: Iterable<TSource>,
    _part: DOMPart.ChildNodePart,
    scope: Scope.ChildScope<DOMPart.ChildNodePart>,
    session: Session<DOMPart.ChildNodePart, DOMRenderer>,
  ): DOMFragment<TSource> {
    const mutations: Mutation[] = [];
    const slots: Slot<DOMPart.ChildNodePart>[] = [];

    for (const item of source) {
      const slot = new Slot(
        session.renderer.renderChildNodePart(),
        wrap(item),
        scope,
      );
      slots.push(slot);
      mutations.push({
        type: InsertType,
        slot: slot,
      });
    }

    return new DOMFragment(slots, mutations);
  }

  constructor(slots: Slot<DOMPart.ChildNodePart>[], mutations: Mutation[]) {
    this._pendingSlots = slots;
    this._mutations = mutations;
  }

  get children(): Slot<DOMPart.ChildNodePart>[] {
    return this._pendingSlots;
  }

  patch(
    source: Iterable<TSource>,
    _part: DOMPart.ChildNodePart,
    scope: Scope.ChildScope<DOMPart.ChildNodePart>,
    session: Session<DOMPart.ChildNodePart, DOMRenderer>,
  ): void {
    const oldKeys = this._pendingSlots.map(
      (slot, index) => slot.directive.key ?? index,
    );
    const oldSlots: (Slot<DOMPart.ChildNodePart> | undefined)[] =
      this._pendingSlots.slice();
    const newDirectives = Array.from(source, wrap);
    const newKeys = newDirectives.map((node, index) => node.key ?? index);
    const newMutations: Mutation[] = [];
    const newSlots: Slot<DOMPart.ChildNodePart>[] = new Array(
      newDirectives.length,
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
            newDirectives[newHead]!,
            scope,
          );
          newMutations.push({
            type: InsertType,
            slot: newSlot,
            afterSlot: newSlots[newTail + 1],
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
        headSlot.update(newDirectives[newHead]!, scope);
        newMutations.push({
          type: UpdateType,
          slot: headSlot,
        });
        newSlots[newHead] = headSlot;
        oldHead++;
        newHead++;
      } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        const tailSlot = oldSlots[oldTail]!;
        tailSlot.update(newDirectives[newTail]!, scope);
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
        const headSlot = oldSlots[oldHead]!;
        const tailSlot = oldSlots[oldTail]!;
        headSlot.update(newDirectives[newHead]!, scope);
        tailSlot.update(newDirectives[newTail]!, scope);
        newMutations.push({
          type: UpdateAndMoveType,
          slot: tailSlot,
          afterSlot: oldSlots[oldHead],
        });
        newMutations.push({
          type: UpdateAndMoveType,
          slot: headSlot,
          afterSlot: newSlots[newTail + 1],
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
          newMutations.push({
            type: RemoveType,
            slot: headSlot,
          });
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          const tailSlot = oldSlots[oldTail]!;
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
            const slot = oldSlots[oldIndex]!;
            slot.update(newDirectives[newTail]!, scope);
            newMutations.push({
              type: UpdateAndMoveType,
              slot,
              afterSlot: newSlots[newTail + 1],
            });
            newSlots[newTail] = slot;
            oldSlots[oldIndex] = undefined;
          } else {
            const newSlot = new Slot(
              session.renderer.renderChildNodePart(),
              wrap(newDirectives[newTail]),
              scope,
            );
            newMutations.push({
              type: InsertType,
              slot: newSlot,
              afterSlot: newSlots[newTail + 1],
            });
            newSlots[newTail] = newSlot;
          }

          newTail--;
        }
      }
    }

    this._pendingSlots = newSlots;
    this._mutations = newMutations;
  }

  mount(part: DOMPart.ChildNodePart): void {
    for (const { type, slot, afterSlot } of this._mutations.splice(0)) {
      switch (type) {
        case InsertType:
          insertChildNodePart(part, slot.part, afterSlot?.part);
          slot.commit();
          break;
        case UpdateType:
          slot.commit();
          break;
        case UpdateAndMoveType:
          moveChildNodePart(part, slot.part, afterSlot?.part);
          slot.commit();
          break;
        case RemoveType:
          slot.beforeRevert();
          slot.revert();
          slot.part.sentinelNode.remove();
          break;
      }
    }
    part.node = this._pendingSlots[0]?.part.node ?? part.sentinelNode;
    this._currentSlots = this._pendingSlots;
  }

  afterMount(_part: DOMPart.ChildNodePart): void {
    for (const slot of this._currentSlots) {
      slot.afterCommit();
    }
  }

  beforeUnmount(_part: DOMPart.ChildNodePart): void {
    for (const slot of this._currentSlots) {
      slot.beforeRevert();
    }
  }

  unmount(part: DOMPart.ChildNodePart): void {
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
