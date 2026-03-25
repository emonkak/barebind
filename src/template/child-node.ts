import type { DirectiveType, Session } from '../core.js';
import {
  createChildNodePart,
  type DOMPart,
  replaceSentinelNode,
} from '../dom.js';
import { Slot } from '../slot.js';
import { Template, type TemplateResult } from './template.js';

export class ChildNodeTemplate<T> extends Template<[T]> {
  static readonly Default: ChildNodeTemplate<any> = new ChildNodeTemplate();

  get arity(): 1 {
    return 1;
  }

  equals(other: DirectiveType<unknown>): boolean {
    return other instanceof ChildNodeTemplate;
  }

  hydrate(
    exprs: readonly [unknown],
    part: DOMPart.ChildNodePart,
    hydrationTarget: TreeWalker,
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const childNodePart = createChildNodePart(
      part.sentinelNode.ownerDocument.createComment(''),
      part.namespaceURI,
    );
    const childNodeSlot = Slot.place(exprs[0], childNodePart, context);

    childNodeSlot.attach(session);

    replaceSentinelNode(hydrationTarget, childNodePart.sentinelNode);

    return { childNodes: [childNodePart.sentinelNode], slots: [childNodeSlot] };
  }

  render(
    exprs: readonly [unknown],
    part: DOMPart.ChildNodePart,
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const childNodePart = createChildNodePart(
      part.sentinelNode.ownerDocument.createComment(''),
      part.namespaceURI,
    );
    const childNodeSlot = Slot.place(exprs[0], childNodePart, context);

    childNodeSlot.attach(session);

    return { childNodes: [childNodePart.sentinelNode], slots: [childNodeSlot] };
  }
}
