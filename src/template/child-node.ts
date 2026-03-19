import type {
  DirectiveType,
  Part,
  TemplateResult,
  UpdateSession,
} from '../core.js';
import { replaceMarkerNode } from '../hydration.js';
import { createChildNodePart } from '../part.js';
import { AbstractTemplate } from './template.js';

export class ChildNodeTemplate<T> extends AbstractTemplate<[T]> {
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
    targetTree: TreeWalker,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const { sentinelNode, namespaceURI } = part;
    const childNodePart = createChildNodePart(
      sentinelNode.ownerDocument.createComment(''),
      namespaceURI,
    );
    const childNodeSlot = context.resolveSlot(values[0], childNodePart);

    childNodeSlot.attach(session);

    replaceMarkerNode(targetTree, childNodePart.sentinelNode);

    return { children: [childNodePart.sentinelNode], slots: [childNodeSlot] };
  }

  render(
    values: readonly [unknown],
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const { sentinelNode, namespaceURI } = part;
    const childNodePart = createChildNodePart(
      sentinelNode.ownerDocument.createComment(''),
      namespaceURI,
    );
    const childNodeSlot = context.resolveSlot(values[0], childNodePart);

    childNodeSlot.attach(session);

    return { children: [childNodePart.sentinelNode], slots: [childNodeSlot] };
  }
}
