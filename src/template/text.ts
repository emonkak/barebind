import { splitText } from '../hydration.js';
import {
  type HydrationTarget,
  type Part,
  PartType,
  type TemplateResult,
  type UpdateSession,
} from '../internal.js';
import { AbstractTemplate } from './template.js';

export class TextTemplate<T = unknown> extends AbstractTemplate<readonly [T]> {
  private readonly _precedingText: string;

  private readonly _followingText: string;

  constructor(precedingText: string = '', followingText: string = '') {
    super();
    this._precedingText = precedingText;
    this._followingText = followingText;
  }

  get arity(): 1 {
    return 1;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof TextTemplate &&
      other._precedingText === this._precedingText &&
      other._followingText === this._followingText
    );
  }

  hydrate(
    binds: readonly [T],
    _part: Part.ChildNodePart,
    target: HydrationTarget,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const textPart = {
      type: PartType.Text,
      node: splitText(target),
      precedingText: this._precedingText,
      followingText: this._followingText,
    };
    const textSlot = context.resolveSlot(binds[0], textPart);

    textSlot.connect(session);

    return { childNodes: [textPart.node], slots: [textSlot] };
  }

  render(
    binds: readonly [T],
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const document = part.node.ownerDocument;
    const textPart = {
      type: PartType.Text,
      node: document.createTextNode(''),
      precedingText: this._precedingText,
      followingText: this._followingText,
    };
    const textSlot = context.resolveSlot(binds[0], textPart);

    textSlot.connect(session);

    return { childNodes: [textPart.node], slots: [textSlot] };
  }
}
