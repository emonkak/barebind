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
  name: 'ChildNodeTemplate',
  hydrate(
    binds: readonly [unknown],
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const childPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    } as const;
    const slot = context.resolveSlot(binds[0], childPart);

    slot.hydrate(hydrationTree, context);

    hydrationTree
      .popNode(childPart.node.nodeType, childPart.node.nodeName)
      .replaceWith(childPart.node);

    return { childNodes: [childPart.node], slots: [slot] };
  },
  render(
    binds: readonly [unknown],
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const slotPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    } as const;
    const slot = context.resolveSlot(binds[0], slotPart);

    slot.connect(context);

    return { childNodes: [slotPart.node], slots: [slot] };
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
