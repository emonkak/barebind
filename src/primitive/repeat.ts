import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Session,
  toDirectiveNode,
} from '../core.js';
import {
  DOM_PART_TYPE_CHILD_NODE,
  type DOMPart,
  ensurePartType,
  insertChildNodePart,
  moveChildNodePart,
} from '../dom.js';
import { DirectiveError } from '../error.js';
import {
  MUTATION_TYPE_INSERT,
  MUTATION_TYPE_REMOVE,
  MUTATION_TYPE_UPDATE,
  MUTATION_TYPE_UPDATE_AND_MOVE,
  type Mutation,
  reconcileNodes,
} from '../reconciliation.js';
import type { Slot } from '../slot.js';
import { isIterable } from './primitive.js';

export abstract class Repeat {
  static ensureValue(
    value: unknown,
    part: DOMPart,
  ): asserts value is Iterable<unknown> {
    DEBUG: {
      if (!isIterable(value)) {
        throw new DirectiveError(
          this,
          value,
          part,
          'Repeat values must be Iterable.',
        );
      }
    }
  }

  static resolveBinding<TSource>(
    source: Iterable<TSource>,
    part: DOMPart,
    _context: DirectiveContext,
  ): RepeatBinding<TSource> {
    DEBUG: {
      ensurePartType(DOM_PART_TYPE_CHILD_NODE, this, source, part);
    }
    return new RepeatBinding(source, part);
  }
}

export class RepeatBinding<TSource>
  implements Binding<Iterable<TSource>, DOMPart.ChildNodePart>
{
  private _source: Iterable<TSource>;

  private readonly _part: DOMPart.ChildNodePart;

  private _pendingSlots: Slot<Directive.Node, DOMPart.ChildNodePart>[] = [];

  private _pendingMutations: Mutation[] = [];

  private _currentSlots: Slot<Directive.Node, DOMPart.ChildNodePart>[] | null =
    null;

  constructor(source: Iterable<TSource>, part: DOMPart.ChildNodePart) {
    this._source = source;
    this._part = part;
  }

  get type(): DirectiveType<Iterable<TSource>, DOMPart.ChildNodePart> {
    return Repeat;
  }

  get value(): Iterable<TSource> {
    return this._source;
  }

  set value(source: Iterable<TSource>) {
    this._source = source;
  }

  get part(): DOMPart.ChildNodePart {
    return this._part;
  }

  shouldUpdate(source: Iterable<TSource>): boolean {
    return this._currentSlots === null || source !== this._source;
  }

  attach(session: Session): void {
    const oldSlots = this._currentSlots ?? [];
    const newNodes = Array.from(this._source, toDirectiveNode);
    const { mutations, slots } = reconcileNodes(
      oldSlots,
      newNodes,
      this._part,
      session,
    );

    this._pendingSlots = slots;
    this._pendingMutations = mutations;
  }

  detach(session: Session): void {
    if (this._currentSlots !== null) {
      for (const slot of this._currentSlots) {
        slot.detach(session);
      }
    }
  }

  commit(): void {
    for (const { type, slot, refSlot } of this._pendingMutations.splice(0)) {
      switch (type) {
        case MUTATION_TYPE_INSERT:
          insertChildNodePart(this._part, slot.part, refSlot?.part);
          slot.commit();
          break;
        case MUTATION_TYPE_UPDATE:
          slot.commit();
          break;
        case MUTATION_TYPE_UPDATE_AND_MOVE:
          moveChildNodePart(this._part, slot.part, refSlot?.part);
          slot.commit();
          break;
        case MUTATION_TYPE_REMOVE:
          slot.rollback();
          slot.part.sentinelNode.remove();
          break;
      }
    }

    this._part.node =
      this._pendingSlots[0]?.part.node ?? this._part.sentinelNode;
    this._currentSlots = this._pendingSlots;
  }

  rollback(): void {
    if (this._currentSlots !== null) {
      for (const slot of this._currentSlots) {
        slot.rollback();
        slot.part.sentinelNode.remove();
      }
    }

    this._part.node = this._part.sentinelNode;
    this._currentSlots = null;
  }
}
