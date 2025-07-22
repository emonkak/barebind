import {
  type DirectiveType,
  type HydrationNodeScanner,
  type Part,
  PartType,
  type TemplateResult,
  type UpdateContext,
} from '../core.js';
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
    nodeScanner: HydrationNodeScanner,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
      namespaceURI: part.namespaceURI,
    };
    const childNodeSlot = context.resolveSlot(binds[0], childNodePart);

    childNodeSlot.hydrate(nodeScanner, context);

    nodeScanner
      .nextNode(childNodePart.node.nodeName)
      .replaceWith(childNodePart.node);

    return { childNodes: [childNodePart.node], slots: [childNodeSlot] };
  }

  render(
    binds: readonly [unknown],
    part: Part.ChildNodePart,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
      namespaceURI: part.namespaceURI,
    };
    const childNodeSlot = context.resolveSlot(binds[0], childNodePart);

    childNodeSlot.connect(context);

    return { childNodes: [childNodePart.node], slots: [childNodeSlot] };
  }
}
