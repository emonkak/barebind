import type { DirectiveType, Part, Session } from '../core.js';
import { replaceSentinelNode, treatNodeName } from '../hydration.js';
import {
  createChildNodePart,
  createElementPart,
  getNamespaceURIByTagName,
} from '../part.js';
import { Slot } from '../slot.js';
import { Template, type TemplateResult } from '../template/template.js';

export class ElementTemplate<
  TProps = unknown,
  TChildren = unknown,
> extends Template<readonly [TProps, TChildren]> {
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
    hydrationTarget: TreeWalker,
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const { ownerDocument } = part.sentinelNode;
    const namespaceURI =
      getNamespaceURIByTagName(this._tagName) ?? part.namespaceURI;
    const elementPart = createElementPart(
      treatNodeName(
        this._tagName.toUpperCase(),
        hydrationTarget.nextNode(),
        hydrationTarget,
      ) as Element,
    );
    const childrenPart = createChildNodePart(
      ownerDocument.createComment(''),
      namespaceURI,
    );
    const elementSlot = Slot.place(values[0], elementPart, context);
    const childrenSlot = Slot.place(values[1], childrenPart, context);

    elementSlot.attach(session);
    childrenSlot.attach(session);

    replaceSentinelNode(hydrationTarget, childrenPart.sentinelNode);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }

  render(
    values: readonly [TProps, TChildren],
    part: Part.ChildNodePart,
    session: Session,
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
    const elementSlot = Slot.place(values[0], elementPart, context);
    const childrenSlot = Slot.place(values[1], childrenPart, context);

    elementPart.node.appendChild(childrenPart.node);

    elementSlot.attach(session);
    childrenSlot.attach(session);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }
}
