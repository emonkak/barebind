import { DirectiveSpecifier } from '../directive.js';
import { replaceMarkerNode, treatNodeName } from '../hydration.js';
import {
  type DirectiveType,
  type HydrationTree,
  type Part,
  PartType,
  type TemplateResult,
  type UpdateContext,
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
  private readonly _name: string;

  constructor(name: string) {
    super();
    this._name = name;
  }

  get arity(): 2 {
    return 2;
  }

  equals(other: DirectiveType<unknown>): boolean {
    return other instanceof ElementTemplate && other._name === this._name;
  }

  hydrate(
    binds: readonly [TProps, TChildren],
    part: Part.ChildNodePart,
    target: HydrationTree,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const namespaceURI =
      getNamespaceURIByTagName(this._name) ?? part.namespaceURI;
    const elementPart = {
      type: PartType.Element,
      node: treatNodeName(
        this._name.toUpperCase(),
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

    elementSlot.hydrate(target, context);
    childrenSlot.hydrate(target, context);

    replaceMarkerNode(target, childrenPart.node);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }

  render(
    binds: readonly [TProps, TChildren],
    part: Part.ChildNodePart,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const namespaceURI =
      getNamespaceURIByTagName(this._name) ?? part.namespaceURI;
    const elementPart = {
      type: PartType.Element,
      node: document.createElementNS(namespaceURI, this._name),
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

    elementSlot.connect(context);
    childrenSlot.connect(context);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }
}
