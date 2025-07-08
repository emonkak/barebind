import { inspectPart, markUsedValue } from '../debug.js';
import {
  type Binding,
  type Directive,
  type DirectiveContext,
  DirectiveSpecifier,
  type Template,
  type TemplateResult,
  type UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from '../template/template.js';

export const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
export const MATH_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';

export function htmlElement<TProps, TChildren>(
  name: string,
  props: TProps,
  children: TChildren,
): DirectiveSpecifier<readonly [TProps, TChildren]> {
  return new DirectiveSpecifier(new ElementTemplate(name, HTML_NAMESPACE), [
    props,
    children,
  ]);
}

export function mathElement<TProps, TChildren>(
  name: string,
  props: TProps,
  children: TChildren,
): DirectiveSpecifier<readonly [TProps, TChildren]> {
  return new DirectiveSpecifier(new ElementTemplate(name, MATH_NAMESPACE), [
    props,
    children,
  ]);
}

export function svgElement<TProps, TChildren>(
  name: string,
  props: TProps,
  children: TChildren,
): DirectiveSpecifier<readonly [TProps, TChildren]> {
  return new DirectiveSpecifier(new ElementTemplate(name, SVG_NAMESPACE), [
    props,
    children,
  ]);
}

export class ElementTemplate<TProps = unknown, TChildren = unknown>
  implements Template<readonly [TProps, TChildren]>
{
  private readonly _name: string;

  private readonly _namespace: string | null;

  constructor(name: string, namespace: string | null) {
    this._name = name;
    this._namespace = namespace;
  }

  get displayName(): string {
    return ElementTemplate.name;
  }

  equals(other: Directive<unknown>): boolean {
    return (
      other instanceof ElementTemplate &&
      other._name === this._name &&
      other._namespace === this._namespace
    );
  }

  hydrate(
    binds: readonly [TProps, TChildren],
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const elementPart = {
      type: PartType.Element,
      node: hydrationTree.popNode(Node.ELEMENT_NODE, this._name.toUpperCase()),
    };
    const childrenPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const elementSlot = context.resolveSlot(binds[0], elementPart);
    const childrenSlot = context.resolveSlot(binds[1], childrenPart);

    elementSlot.hydrate(hydrationTree, context);
    childrenSlot.hydrate(hydrationTree, context);

    hydrationTree
      .popNode(childrenPart.node.nodeType, childrenPart.node.nodeName)
      .replaceWith(childrenPart.node);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }

  render(
    binds: readonly [TProps, TChildren],
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const elementPart = {
      type: PartType.Element,
      node: document.createElementNS(this._namespace, this._name),
    };
    const childrenPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const elementSlot = context.resolveSlot(binds[0], elementPart);
    const childrenSlot = context.resolveSlot(binds[1], childrenPart);

    elementSlot.connect(context);
    childrenSlot.connect(context);

    elementPart.node.appendChild(childrenPart.node);

    return {
      childNodes: [elementPart.node],
      slots: [elementSlot, childrenSlot],
    };
  }

  resolveBinding(
    binds: readonly [TProps, TChildren],
    part: Part,
    _context: DirectiveContext,
  ): Binding<readonly [TProps, TChildren]> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'ElementTemplate must be used in a child node part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(binds)),
      );
    }

    return new TemplateBinding(this, binds, part);
  }
}
