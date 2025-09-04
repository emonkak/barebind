import { DirectiveSpecifier } from '../directive.js';
import { mountMarkerNode, treatNodeName } from '../hydration.js';
import {
  type DirectiveType,
  type HydrationTarget,
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
  readonly tagName: string;

  constructor(tagName: string) {
    super();
    this.tagName = tagName;
  }

  get arity(): 2 {
    return 2;
  }

  equals(other: DirectiveType<unknown>): boolean {
    return other instanceof ElementTemplate && other.tagName === this.tagName;
  }

  hydrate(
    binds: readonly [TProps, TChildren],
    part: Part.ChildNodePart,
    target: HydrationTarget,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const document = part.node.ownerDocument;
    const namespaceURI =
      getNamespaceURIByTagName(this.tagName) ?? part.namespaceURI;
    const elementPart = {
      type: PartType.Element,
      node: treatNodeName(
        this.tagName.toUpperCase(),
        target.nextNode(),
        target,
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

    elementSlot.connect(session);
    childrenSlot.connect(session);

    mountMarkerNode(target, childrenPart.node);

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
      getNamespaceURIByTagName(this.tagName) ?? part.namespaceURI;
    const elementPart = {
      type: PartType.Element,
      node: document.createElementNS(namespaceURI, this.tagName),
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

    elementSlot.connect(session);
    childrenSlot.connect(session);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }
}
