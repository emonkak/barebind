import { inspectPart, markUsedValue } from '../debug.js';
import type {
  DirectiveContext,
  Template,
  TemplateBlock,
  UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from './template.js';

export class TextTemplate<T = unknown> implements Template<readonly [T]> {
  private readonly _precedingText: string;

  private readonly _followingText: string;

  constructor(precedingText: string, followingText: string) {
    this._precedingText = precedingText;
    this._followingText = followingText;
  }

  get name(): string {
    return 'TextTemplate';
  }

  hydrate(
    binds: readonly [T],
    _part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateBlock {
    const slotPart = {
      type: PartType.Text,
      node: hydrationTree.popNode(Node.TEXT_NODE, '#text'),
      precedingText: this._precedingText,
      followingText: this._followingText,
    } as const;
    const slot = context.resolveSlot(binds[0], slotPart);

    slot.hydrate(hydrationTree, context);

    return { childNodes: [slotPart.node], slots: [slot] };
  }

  render(
    binds: readonly [T],
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateBlock {
    const document = part.node.ownerDocument;
    const slotPart = {
      type: PartType.Text,
      node: document.createTextNode(''),
      precedingText: this._precedingText,
      followingText: this._followingText,
    } as const;
    const slot = context.resolveSlot(binds[0], slotPart);

    slot.connect(context);

    return { childNodes: [slotPart.node], slots: [slot] };
  }

  resolveBinding(
    binds: readonly [T],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [T]> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'TextTemplate must be used in a child node part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(binds)),
      );
    }

    return new TemplateBinding(this as Template<readonly [T]>, binds, part);
  }
}
