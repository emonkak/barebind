import { inspectPart, markUsedValue } from '../debug.js';
import type {
  DirectiveContext,
  Template,
  TemplateResult,
  UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from './template.js';

export const ChildNodeTemplate: Template<readonly [unknown]> = {
  displayName: 'ChildNodeTemplate',
  hydrate(
    binds: readonly [unknown],
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    } as const;
    const childNodeSlot = context.resolveSlot(binds[0], childNodePart);

    childNodeSlot.hydrate(hydrationTree, context);

    hydrationTree
      .popNode(childNodePart.node.nodeType, childNodePart.node.nodeName)
      .replaceWith(childNodePart.node);

    return { childNodes: [childNodePart.node], slots: [childNodeSlot] };
  },
  render(
    binds: readonly [unknown],
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    } as const;
    const childNodeSlot = context.resolveSlot(binds[0], childNodePart);

    childNodeSlot.connect(context);

    return { childNodes: [childNodePart.node], slots: [childNodeSlot] };
  },
  resolveBinding<T>(
    binds: readonly [T],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [T]> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'ChildNodeTemplate must be used in a child node part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(binds)),
      );
    }

    return new TemplateBinding(this as Template<readonly [T]>, binds, part);
  },
};
