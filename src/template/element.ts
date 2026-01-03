import { DirectiveSpecifier } from '../directive.js';
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

export function Element<TProps, TChildren>(
  name: string,
  props: TProps,
  children: TChildren,
): DirectiveSpecifier<readonly [TProps, TChildren]> {
  return new DirectiveSpecifier(new ElementTemplate(name), [props, children]);
}

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
    binds: readonly [TProps, TChildren],
    part: Part.ChildNodePart,
    treeWalker: TreeWalker,
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
        treeWalker.nextNode(),
        treeWalker,
      ) as Element,
    };
    const childrenPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI,
    };
    const elementSlot = context.resolveSlot(binds[0], elementPart);
    const childrenSlot = context.resolveSlot(binds[1], childrenPart);

    elementSlot.attach(session);
    childrenSlot.attach(session);

    replaceMarkerNode(treeWalker, childrenPart.node);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }

  render(
    binds: readonly [TProps, TChildren],
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
    const elementSlot = context.resolveSlot(binds[0], elementPart);
    const childrenSlot = context.resolveSlot(binds[1], childrenPart);

    elementPart.node.appendChild(childrenPart.node);

    elementSlot.attach(session);
    childrenSlot.attach(session);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }
}
