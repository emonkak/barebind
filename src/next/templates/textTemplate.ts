import type {
  Bindable,
  DirectiveContext,
  Template,
  TemplateBlock,
  UpdateContext,
} from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type HydrationTree, ensureText } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from './template.js';

export const TextTemplate: Template<readonly [Bindable<any>]> = {
  name: 'TextTemplate',
  hydrate(
    binds: readonly [Bindable<unknown>],
    _part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateBlock<readonly [Bindable<unknown>]> {
    const slotPart = {
      type: PartType.Text,
      node: ensureText(hydrationTree.popNode()),
    } as const;
    const slot = context.resolveSlot(binds[0], slotPart);

    slot.hydrate(hydrationTree, context);

    return { childNodes: [slotPart.node], slots: [slot] };
  },
  render(
    binds: readonly [Bindable<unknown>],
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateBlock<readonly [Bindable<unknown>]> {
    const slotPart = {
      type: PartType.Text,
      node: part.node.ownerDocument.createTextNode(''),
    } as const;
    const slot = context.resolveSlot(binds[0], slotPart);

    slot.connect(context);

    return { childNodes: [slotPart.node], slots: [slot] };
  },
  resolveBinding(
    binds: readonly [Bindable<unknown>],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [Bindable<unknown>]> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'TextTemplate must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(binds)),
      );
    }

    return new TemplateBinding(this, binds, part);
  },
};
