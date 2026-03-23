import { PART_TYPE_TEXT, type Part, type Session } from '../core.js';
import { createTextPart, splitText } from '../dom.js';
import { Slot } from '../slot.js';
import { Template, type TemplateResult } from './template.js';

export class TextTemplate<T> extends Template<readonly [T]> {
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
    exprs: readonly [T],
    _part: Part.ChildNodePart,
    hydrationTarget: TreeWalker,
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const textPart = {
      type: PART_TYPE_TEXT,
      node: splitText(hydrationTarget),
      precedingText: this._precedingText,
      followingText: this._followingText,
    } as const;
    const textSlot = Slot.place(exprs[0], textPart, context);

    textSlot.attach(session);

    return { childNodes: [textPart.node], slots: [textSlot] };
  }

  render(
    exprs: readonly [T],
    part: Part.ChildNodePart,
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const { ownerDocument } = part.sentinelNode;
    const textPart = createTextPart(
      ownerDocument.createTextNode(''),
      this._precedingText,
      this._followingText,
    );
    const textSlot = Slot.place(exprs[0], textPart, context);

    textSlot.attach(session);

    return { childNodes: [textPart.node], slots: [textSlot] };
  }
}
