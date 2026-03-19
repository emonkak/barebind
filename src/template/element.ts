import type {
  DirectiveType,
  Part,
  TemplateResult,
  UpdateSession,
} from '../core.js';
import { replaceMarkerNode, treatNodeName } from '../hydration.js';
import {
  createChildNodePart,
  createElementPart,
  getNamespaceURIByTagName,
} from '../part.js';
import { AbstractTemplate } from '../template/template.js';

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
    const { ownerDocument } = part.sentinelNode;
    const namespaceURI =
      getNamespaceURIByTagName(this._tagName) ?? part.namespaceURI;
    const elementPart = createElementPart(
      treatNodeName(
        this._tagName.toUpperCase(),
        targetTree.nextNode(),
        targetTree,
      ) as Element,
    );
    const childrenPart = createChildNodePart(
      ownerDocument.createComment(''),
      namespaceURI,
    );
    const elementSlot = context.resolveSlot(values[0], elementPart);
    const childrenSlot = context.resolveSlot(values[1], childrenPart);

    elementSlot.attach(session);
    childrenSlot.attach(session);

    replaceMarkerNode(targetTree, childrenPart.sentinelNode);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }

  render(
    values: readonly [TProps, TChildren],
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const { ownerDocument } = part.sentinelNode;
    const namespaceURI =
      getNamespaceURIByTagName(this._tagName) ?? part.namespaceURI;
    const elementPart = createElementPart(
      ownerDocument.createElementNS(namespaceURI, this._tagName),
    );
    const childrenPart = createChildNodePart(
      ownerDocument.createComment(''),
      namespaceURI,
    );
    const elementSlot = context.resolveSlot(values[0], elementPart);
    const childrenSlot = context.resolveSlot(values[1], childrenPart);

    elementPart.node.appendChild(childrenPart.node);

    elementSlot.attach(session);
    childrenSlot.attach(session);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }
}
