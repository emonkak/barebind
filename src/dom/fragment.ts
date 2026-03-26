import {
  type Binding,
  Directive,
  type DirectiveContext,
  type Session,
} from '../core.js';
import type { Slot } from '../slot.js';
import { ensurePartType } from './error.js';
import { type DOMPart, PART_TYPE_CHILD_NODE } from './part.js';
import { reconcileItems } from './reconciliation.js';
import type { DOMRenderer } from './template.js';

export function Fragment<TSource>(
  source: Iterable<TSource>,
): Directive.Element<Iterable<TSource>> {
  return new Directive(Fragment, source);
}

Fragment.resolveBinding = function resolveBinding<TSource>(
  source: Iterable<TSource>,
  part: DOMPart,
  _context: DirectiveContext<DOMPart, DOMRenderer>,
): FragmentBinding<TSource> {
  ensurePartType(PART_TYPE_CHILD_NODE, this, source, part);
  return new FragmentBinding(source, part);
};

export class FragmentBinding<TSource>
  implements Binding<Iterable<TSource>, DOMPart.ChildNode, DOMRenderer>
{
  private _source: Iterable<TSource>;

  private _part: DOMPart.ChildNode;

  private _pendingSlots: Slot<unknown, DOMPart.ChildNode, DOMRenderer>[] = [];

  private _currentSlots:
    | Slot<unknown, DOMPart.ChildNode, DOMRenderer>[]
    | null = null;

  constructor(source: Iterable<TSource>, part: DOMPart.ChildNode) {
    this._source = source;
    this._part = part;
  }

  get type(): typeof Fragment {
    return Fragment;
  }

  get value(): Iterable<TSource> {
    return this._source;
  }

  set value(newSource: Iterable<TSource>) {
    this._source = newSource;
  }

  get part(): DOMPart.ChildNode {
    return this._part;
  }

  shouldUpdate(newSource: Iterable<TSource>): boolean {
    return this._currentSlots === null || newSource !== this._source;
  }

  attach(session: Session<DOMPart, DOMRenderer>): void {
    this._pendingSlots = reconcileItems(
      this._currentSlots ?? [],
      Array.from(this._source),
      this._part,
      session,
    );
  }

  detach(session: Session<DOMPart, DOMRenderer>): void {
    for (const binding of this._pendingSlots) {
      binding.detach(session);
    }
    this._pendingSlots = [];
  }

  commit(): void {
    const oldSlots = this._currentSlots ?? [];
    const newSlots = this._pendingSlots;

    for (let i = 0, l = newSlots.length; i < l; i++) {
      newSlots[i]!.commit();
    }

    for (let i = newSlots.length, l = oldSlots.length; i < l; i++) {
      oldSlots[i]!.rollback();
    }

    this._currentSlots = newSlots;
    this._part.node = newSlots[0]?.part.node ?? this._part.sentinelNode;
  }

  rollback(): void {
    if (this._currentSlots !== null) {
      for (const binding of this._currentSlots) {
        binding.rollback();
      }
      this._currentSlots = null;
      this._part.node = this._part.sentinelNode;
    }
  }
}
