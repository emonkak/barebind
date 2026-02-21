import { replaceMarkerNode, treatNodeName } from '../hydration.js';
import {
  type DirectiveType,
  type Part,
  PartType,
  type TemplateResult,
  type UpdateSession,
} from '../internal.js';
import {
  AbstractTemplate,
  getNamespaceURIByTagName,
} from '../template/template.js';

export class ElementTemplate<
  TProps = unknown,
  TChildren = unknown,
> extends AbstractTemplate<readonly [TProps, TChildren]> {
  private readonly _tagName: string;

  constructor(tagName: string) {
    super();
    this._tagName = tagName;
  }

  get arity(): 2 {
    return 2;
  }

  equals(other: DirectiveType<unknown>): boolean {
    return other instanceof ElementTemplate && other._tagName === this._tagName;
  }

  hydrate(
    values: readonly [TProps, TChildren],
    part: Part.ChildNodePart,
    targetTree: TreeWalker,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const document = part.node.ownerDocument;
    const namespaceURI =
      getNamespaceURIByTagName(this._tagName) ?? part.namespaceURI;
    const elementPart = {
      type: PartType.Element,
      node: treatNodeName(
        this._tagName.toUpperCase(),
        targetTree.nextNode(),
        targetTree,
      ) as Element,
    };
    const childrenPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI,
    };
    const elementSlot = context.resolveSlot(values[0], elementPart);
    const childrenSlot = context.resolveSlot(values[1], childrenPart);

    elementSlot.attach(session);
    childrenSlot.attach(session);

    replaceMarkerNode(targetTree, childrenPart.node);

    return {
      children: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }

  render(
    values: readonly [TProps, TChildren],
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const document = part.node.ownerDocument;
    const namespaceURI =
      getNamespaceURIByTagName(this._tagName) ?? part.namespaceURI;
    const elementPart = {
      type: PartType.Element,
      node: document.createElementNS(namespaceURI, this._tagName),
    };
    const childrenPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI,
    };
    const elementSlot = context.resolveSlot(values[0], elementPart);
    const childrenSlot = context.resolveSlot(values[1], childrenPart);

    elementPart.node.appendChild(childrenPart.node);

    elementSlot.attach(session);
    childrenSlot.attach(session);

    return {
      children: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }
}
