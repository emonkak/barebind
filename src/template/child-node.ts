import { replaceMarkerNode } from '../hydration.js';
import {
  type DirectiveType,
  type HydrationTree,
  type Part,
  PartType,
  type TemplateResult,
  type UpdateContext,
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
    target: HydrationTree,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: part.namespaceURI,
    };
    const childNodeSlot = context.runtime.resolveSlot(binds[0], childNodePart);

    childNodeSlot.hydrate(target, context);

    replaceMarkerNode(target, childNodePart.node);

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
    const childNodeSlot = context.runtime.resolveSlot(binds[0], childNodePart);

    childNodeSlot.connect(context);

    return { childNodes: [childNodePart.node], slots: [childNodeSlot] };
  }
}
