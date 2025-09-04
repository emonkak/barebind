import { mountMarkerNode } from '../hydration.js';
import {
  type DirectiveType,
  type HydrationTarget,
  type Part,
  PartType,
  type TemplateResult,
  type UpdateSession,
} from '../internal.js';
import { AbstractTemplate } from './template.js';

export class ChildNodeTemplate<T> extends AbstractTemplate<[T]> {
  get arity(): 1 {
    return 1;
  }

  equals(other: DirectiveType<unknown>): boolean {
    return other instanceof ChildNodeTemplate;
  }

  hydrate(
    binds: readonly [unknown],
    part: Part.ChildNodePart,
    target: HydrationTarget,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const document = part.node.ownerDocument;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: part.namespaceURI,
    };
    const childNodeSlot = context.resolveSlot(binds[0], childNodePart);

    childNodeSlot.connect(session);

    mountMarkerNode(target, childNodePart.node);

    return { childNodes: [childNodePart.node], slots: [childNodeSlot] };
  }

  render(
    binds: readonly [unknown],
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const document = part.node.ownerDocument;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: part.namespaceURI,
    };
    const childNodeSlot = context.resolveSlot(binds[0], childNodePart);

    childNodeSlot.connect(session);

    return { childNodes: [childNodePart.node], slots: [childNodeSlot] };
  }
}
