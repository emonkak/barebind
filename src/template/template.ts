import {
  type Binding,
  type DirectiveContext,
  type DirectiveType,
  type Effect,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_TEXT,
  type Part,
  type Session,
} from '../core.js';
import { getHydrationTarget } from '../hydration.js';
import { ensurePartType } from '../part.js';
import type { Slot } from '../slot.js';

export interface TemplateResult {
  childNodes: readonly ChildNode[];
  slots: readonly Slot<unknown>[];
}

export abstract class Template<TValues extends readonly unknown[]>
  implements DirectiveType<TValues>
{
  abstract get arity(): TValues['length'];

  get name(): string {
    return this.constructor.name;
  }

  abstract render(
    values: TValues,
    part: Part.ChildNodePart,
    session: Session,
  ): TemplateResult;

  abstract hydrate(
    values: TValues,
    part: Part.ChildNodePart,
    hydrationTarget: TreeWalker,
    session: Session,
  ): TemplateResult;

  resolveBinding(
    values: TValues,
    part: Part,
    _context: DirectiveContext,
  ): Binding<TValues> {
    ensurePartType(PART_TYPE_CHILD_NODE, this, values, part);
    return new TemplateBinding(this, values, part);
  }
}

export class TemplateBinding<TValues extends readonly unknown[]>
  implements Binding<TValues>, Effect
{
  private readonly _template: Template<TValues>;

  private _values: TValues;

  private readonly _part: Part.ChildNodePart;

  private _pendingResult: TemplateResult | null = null;

  private _memoizedResult: TemplateResult | null = null;

  constructor(
    template: Template<TValues>,
    values: TValues,
    part: Part.ChildNodePart,
  ) {
    this._template = template;
    this._values = values;
    this._part = part;
  }

  get type(): Template<TValues> {
    return this._template;
  }

  get value(): TValues {
    return this._values;
  }

  set value(values: TValues) {
    this._values = values;
  }

  get part(): Part.ChildNodePart {
    return this._part;
  }

  shouldUpdate(values: TValues): boolean {
    return this._memoizedResult === null || values !== this._values;
  }

  attach(session: Session): void {
    if (this._pendingResult !== null) {
      const { slots } = this._pendingResult;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.reconcile(this._values[i]!, session);
      }
    } else {
      const hydrationTarget = getHydrationTarget(session.coroutine.scope);

      if (hydrationTarget !== null) {
        this._pendingResult = this._template.hydrate(
          this._values,
          this._part,
          hydrationTarget,
          session,
        );
        this._memoizedResult = this._pendingResult;
      } else {
        this._pendingResult = this._template.render(
          this._values,
          this._part,
          session,
        );
      }
    }
  }

  detach(session: Session): void {
    if (this._pendingResult !== null) {
      const { slots } = this._pendingResult;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.detach(session);
      }
    }
  }

  commit(): void {
    if (this._pendingResult !== null) {
      const { childNodes, slots } = this._pendingResult;

      if (this._memoizedResult === null) {
        this._part.sentinelNode.before(...childNodes);
      }

      for (const slot of slots) {
        slot.commit();
      }

      this._part.node =
        getStartNode(childNodes, slots) ?? this._part.sentinelNode;
    }

    this._memoizedResult = this._pendingResult;
  }

  rollback(): void {
    if (this._memoizedResult !== null) {
      const { childNodes, slots } = this._memoizedResult;

      for (const slot of slots) {
        if (
          (slot.part.type === PART_TYPE_CHILD_NODE ||
            slot.part.type === PART_TYPE_TEXT) &&
          childNodes.includes(getEndNode(slot.part))
        ) {
          // This binding is mounted as a child of the root, so we must rollback it.
          slot.rollback();
        }
      }

      for (const child of childNodes) {
        child.remove();
      }
    }

    this._part.node = this._part.sentinelNode;
    this._memoizedResult = null;
  }
}

function getStartNode(
  childNodes: readonly ChildNode[],
  slots: readonly Slot<unknown>[],
): ChildNode | null {
  const childNode = childNodes[0];
  const slot = slots[0];
  return childNode !== undefined &&
    slot !== undefined &&
    childNode === getEndNode(slot.part)
    ? slot.part.node
    : (childNode ?? null);
}

function getEndNode(part: Part): ChildNode {
  return part.type === PART_TYPE_CHILD_NODE ? part.sentinelNode : part.node;
}
