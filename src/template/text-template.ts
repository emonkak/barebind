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

export class TextTemplate<T = unknown> implements Template<readonly [T]> {
  private readonly _precedingText: string;

  private readonly _followingText: string;

  constructor(precedingText: string, followingText: string) {
    this._precedingText = precedingText;
    this._followingText = followingText;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof TextTemplate &&
      other._precedingText === this._precedingText &&
      other._followingText === this._followingText
    );
  }

  get displayName(): string {
    return 'TextTemplate';
  }

  hydrate(
    binds: readonly [T],
    _part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateResult {
    const textPart = {
      type: PartType.Text,
      node: hydrationTree.splitText().popNode(Node.TEXT_NODE, '#text'),
      precedingText: this._precedingText,
      followingText: this._followingText,
    } as const;
    const textSlot = context.resolveSlot(binds[0], textPart);

    textSlot.hydrate(hydrationTree, context);

    return { childNodes: [textPart.node], slots: [textSlot] };
  }

  render(
    binds: readonly [T],
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateResult {
    const document = part.node.ownerDocument;
    const textPart = {
      type: PartType.Text,
      node: document.createTextNode(''),
      precedingText: this._precedingText,
      followingText: this._followingText,
    } as const;
    const textSlot = context.resolveSlot(binds[0], textPart);

    textSlot.connect(context);

    return { childNodes: [textPart.node], slots: [textSlot] };
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

    return new TemplateBinding(this, binds, part);
  }
}
