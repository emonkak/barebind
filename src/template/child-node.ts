import {
  type DirectiveType,
  type HydrationTree,
  type Part,
  PartType,
  type TemplateResult,
  treatNodeType,
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
    targetTree: HydrationTree,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: part.namespaceURI,
    };
    const childNodeSlot = context.resolveSlot(binds[0], childNodePart);

    childNodeSlot.hydrate(targetTree, context);

    treatNodeType(
      Node.COMMENT_NODE,
      targetTree.nextNode(),
      targetTree,
    ).replaceWith(childNodePart.node);

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
      anchorNode: null,
      namespaceURI: part.namespaceURI,
    };
    const childNodeSlot = context.resolveSlot(binds[0], childNodePart);

    childNodeSlot.connect(context);

    return { childNodes: [childNodePart.node], slots: [childNodeSlot] };
  }
}
