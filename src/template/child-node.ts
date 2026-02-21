import { replaceMarkerNode } from '../hydration.js';
import {
  type DirectiveType,
  type Part,
  PartType,
  type TemplateResult,
  type UpdateSession,
} from '../internal.js';
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
    const document = part.node.ownerDocument;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: part.namespaceURI,
    };
    const childNodeSlot = context.resolveSlot(values[0], childNodePart);

    childNodeSlot.attach(session);

    replaceMarkerNode(targetTree, childNodePart.node);

    return { children: [childNodePart.node], slots: [childNodeSlot] };
  }

  render(
    values: readonly [unknown],
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
    const childNodeSlot = context.resolveSlot(values[0], childNodePart);

    childNodeSlot.attach(session);

    return { children: [childNodePart.node], slots: [childNodeSlot] };
  }
}
