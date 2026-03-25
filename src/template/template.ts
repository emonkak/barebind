import type {
  Binding,
  DirectiveContext,
  DirectiveType,
  Effect,
  Session,
} from '../core.js';
import {
  DOM_PART_TYPE_CHILD_NODE,
  DOM_PART_TYPE_TEXT,
  type DOMPart,
  ensurePartType,
  getHydrationTarget,
} from '../dom.js';
import type { Slot } from '../slot.js';

export interface TemplateResult {
  childNodes: readonly ChildNode[];
  slots: readonly Slot<unknown, DOMPart>[];
}

export abstract class Template<TExprs extends readonly unknown[]>
  implements DirectiveType<TExprs, DOMPart.ChildNodePart>
{
  abstract get arity(): TExprs['length'];

  get name(): string {
    return this.constructor.name;
  }

  abstract render(
    exprs: TExprs,
    part: DOMPart.ChildNodePart,
    session: Session,
  ): TemplateResult;

  abstract hydrate(
    exprs: TExprs,
    part: DOMPart.ChildNodePart,
    hydrationTarget: TreeWalker,
    session: Session,
  ): TemplateResult;

  resolveBinding(
    exprs: TExprs,
    part: DOMPart.ChildNodePart,
    _context: DirectiveContext,
  ): Binding<TExprs, DOMPart.ChildNodePart> {
    ensurePartType(DOM_PART_TYPE_CHILD_NODE, this, exprs, part);
    return new TemplateBinding(this, exprs, part);
  }
}

export class TemplateBinding<TExprs extends readonly unknown[]>
  implements Binding<TExprs, DOMPart.ChildNodePart>, Effect
{
  private readonly _template: Template<TExprs>;

  private _exprs: TExprs;

  private readonly _part: DOMPart.ChildNodePart;

  private _memoizedResult: TemplateResult | null = null;

  constructor(
    template: Template<TExprs>,
    exprs: TExprs,
    part: DOMPart.ChildNodePart,
  ) {
    this._template = template;
    this._exprs = exprs;
    this._part = part;
  }

  get type(): Template<TExprs> {
    return this._template;
  }

  get value(): TExprs {
    return this._exprs;
  }

  set value(exprs: TExprs) {
    this._exprs = exprs;
  }

  get part(): DOMPart.ChildNodePart {
    return this._part;
  }

  shouldUpdate(newExprs: TExprs): boolean {
    return this._memoizedResult === null || newExprs !== this._exprs;
  }

  attach(session: Session): void {
    if (this._memoizedResult !== null) {
      const { slots } = this._memoizedResult;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.update(this._exprs[i]!, session);
      }
    } else {
      const hydrationTarget = getHydrationTarget(session.coroutine.scope);

      if (hydrationTarget !== null) {
        this._memoizedResult = this._template.hydrate(
          this._exprs,
          this._part,
          hydrationTarget,
          session,
        );
      } else {
        this._memoizedResult = this._template.render(
          this._exprs,
          this._part,
          session,
        );
      }
    }
  }

  detach(session: Session): void {
    if (this._memoizedResult !== null) {
      const { slots } = this._memoizedResult;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.detach(session);
      }
    }
  }

  commit(): void {
    if (this._memoizedResult !== null) {
      const { childNodes, slots } = this._memoizedResult;

      if (this._part.node === this._part.sentinelNode) {
        this._part.sentinelNode.before(...childNodes);
      }

      for (const slot of slots) {
        slot.commit();
      }

      this._part.node =
        getStartNode(childNodes, slots) ?? this._part.sentinelNode;
    }
  }

  rollback(): void {
    if (this._memoizedResult !== null) {
      const { childNodes, slots } = this._memoizedResult;

      for (const slot of slots) {
        if (
          (slot.part.type === DOM_PART_TYPE_CHILD_NODE ||
            slot.part.type === DOM_PART_TYPE_TEXT) &&
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
  }
}

function getStartNode(
  childNodes: readonly ChildNode[],
  slots: readonly Slot<unknown, DOMPart>[],
): ChildNode | null {
  const childNode = childNodes[0];
  const slot = slots[0];
  return childNode !== undefined &&
    slot !== undefined &&
    childNode === getEndNode(slot.part)
    ? slot.part.node
    : (childNode ?? null);
}

function getEndNode(part: DOMPart): ChildNode {
  return part.type === DOM_PART_TYPE_CHILD_NODE ? part.sentinelNode : part.node;
}
