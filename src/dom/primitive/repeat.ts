import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Session,
  toDirectiveNode,
} from '../../core.js';
import { isIterable } from '../../primitive.js';
import type { Slot } from '../../slot.js';
import { DirectiveError, ensurePartType } from '../error.js';
import {
  type DOMPart,
  insertChildNodePart,
  moveChildNodePart,
  PART_TYPE_CHILD_NODE,
} from '../part.js';
import {
  MUTATION_TYPE_INSERT,
  MUTATION_TYPE_REMOVE,
  MUTATION_TYPE_UPDATE,
  MUTATION_TYPE_UPDATE_AND_MOVE,
  type Mutation,
  reconcileNodes,
} from '../reconciliation.js';
import type { DOMRenderer } from '../template.js';

export abstract class DOMRepeat {
  static ensureValue(
    value: unknown,
    part: DOMPart,
  ): asserts value is Iterable<unknown> {
    DEBUG: {
      if (!isIterable(value)) {
        throw new DirectiveError(
          DOMRepeat,
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
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMRepeatBinding<TSource> {
    DEBUG: {
      ensurePartType(PART_TYPE_CHILD_NODE, this, source, part);
    }
    return new DOMRepeatBinding(source, part);
  }
}

export class DOMRepeatBinding<TSource>
  implements Binding<Iterable<TSource>, DOMPart.ChildNode>
{
  private _pendingSource: Iterable<TSource>;

  private readonly _part: DOMPart.ChildNode;

  private _pendingMutations: Mutation[] = [];

  private _pendingSlots: Slot<
    Directive.Node,
    DOMPart.ChildNode,
    DOMRenderer
  >[] = [];

  private _currentSource: Iterable<TSource> | null = null;

  private _currentSlots:
    | Slot<Directive.Node, DOMPart.ChildNode, DOMRenderer>[]
    | null = null;

  constructor(source: Iterable<TSource>, part: DOMPart.ChildNode) {
    this._pendingSource = source;
    this._part = part;
  }

  get type(): DirectiveType<Iterable<TSource>, DOMPart.ChildNode> {
    return DOMRepeat;
  }

  get value(): Iterable<TSource> {
    return this._pendingSource;
  }

  set value(newSource: Iterable<TSource>) {
    this._pendingSource = newSource;
  }

  get part(): DOMPart.ChildNode {
    return this._part;
  }

  shouldUpdate(newSource: Iterable<TSource>): boolean {
    return this._currentSource === null || newSource !== this._currentSource;
  }

  attach(session: Session<DOMPart, DOMRenderer>): void {
    const { mutations, slots } = reconcileNodes(
      this._currentSlots ?? [],
      Array.from(this._pendingSource, toDirectiveNode),
      this._part,
      session,
    );

    this._pendingMutations = mutations;
    this._pendingSlots = slots;
  }

  detach(session: Session<DOMPart, DOMRenderer>): void {
    for (const slot of this._pendingSlots) {
      slot.detach(session);
    }

    this._pendingMutations = [];
    this._pendingSlots = [];
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

    this._currentSlots = this._pendingSlots;
    this._currentSource = this._pendingSource;
    this._part.node =
      this._pendingSlots[0]?.part.node ?? this._part.sentinelNode;
  }

  rollback(): void {
    if (this._currentSlots !== null) {
      for (const slot of this._currentSlots) {
        slot.rollback();
        slot.part.sentinelNode.remove();
      }
    }

    this._currentSlots = null;
    this._currentSource = null;
    this._part.node = this._part.sentinelNode;
  }
}
