import { inspectPart, markUsedValue } from '../debug.js';
import type {
  Binding,
  Directive,
  DirectiveContext,
  Template,
  TemplateResult,
  UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from '../template/template.js';

export class ElementTemplate<TProps, TChildren>
  implements Template<readonly [TProps, TChildren]>
{
  private readonly _name: string;

  constructor(name: string) {
    this._name = name;
  }

  get displayName(): string {
    return ElementTemplate.name;
  }

  equals(other: Directive<unknown>): boolean {
    return other instanceof ElementTemplate && other._name === this._name;
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
      node: document.createElement(this._name),
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
