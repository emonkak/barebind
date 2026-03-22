import type { DirectiveType, Part, Session } from '../core.js';
import { replaceSentinelNode } from '../hydration.js';
import { createChildNodePart } from '../part.js';
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
    values: readonly [unknown],
    part: Part.ChildNodePart,
    hydrationTarget: TreeWalker,
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const childNodePart = createChildNodePart(
      part.sentinelNode.ownerDocument.createComment(''),
      part.namespaceURI,
    );
    const childNodeSlot = Slot.place(values[0], childNodePart, context);

    childNodeSlot.attach(session);

    replaceSentinelNode(hydrationTarget, childNodePart.sentinelNode);

    return { childNodes: [childNodePart.sentinelNode], slots: [childNodeSlot] };
  }

  render(
    values: readonly [unknown],
    part: Part.ChildNodePart,
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const childNodePart = createChildNodePart(
      part.sentinelNode.ownerDocument.createComment(''),
      part.namespaceURI,
    );
    const childNodeSlot = Slot.place(values[0], childNodePart, context);

    childNodeSlot.attach(session);

    return { childNodes: [childNodePart.sentinelNode], slots: [childNodeSlot] };
  }
}
