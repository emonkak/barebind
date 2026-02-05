import { splitText } from '../hydration.js';
import {
  type Part,
  PartType,
  type TemplateResult,
  type UpdateSession,
} from '../internal.js';
import { AbstractTemplate } from './template.js';

export class TextTemplate<T> extends AbstractTemplate<readonly [T]> {
  static readonly Default: TextTemplate<any> = new TextTemplate();

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
    args: readonly [T],
    _part: Part.ChildNodePart,
    targetTree: TreeWalker,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const textPart = {
      type: PartType.Text,
      node: splitText(targetTree),
      precedingText: this._precedingText,
      followingText: this._followingText,
    };
    const textSlot = context.resolveSlot(args[0], textPart);

    textSlot.attach(session);

    return { children: [textPart.node], slots: [textSlot] };
  }

  render(
    args: readonly [T],
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
    const textSlot = context.resolveSlot(args[0], textPart);

    textSlot.attach(session);

    return { children: [textPart.node], slots: [textSlot] };
  }
}
