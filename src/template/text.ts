import type { Part, Session } from '../core.js';
import { createTextPart, nextNode } from '../dom.js';
import { Slot } from '../slot.js';
import { Template, type TemplateResult } from './template.js';

export class TextTemplate<T> extends Template<readonly [T]> {
  static readonly Default: TextTemplate<any> = new TextTemplate();

  get arity(): 1 {
    return 1;
  }

  equals(other: unknown): boolean {
    return other instanceof TextTemplate;
  }

  hydrate(
    exprs: readonly [T],
    _part: Part.ChildNodePart,
    hydrationTarget: TreeWalker,
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const textPart = createTextPart(nextNode('#text', hydrationTarget));
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
    const textPart = createTextPart(ownerDocument.createTextNode(''));
    const textSlot = Slot.place(exprs[0], textPart, context);

    textSlot.attach(session);

    return { childNodes: [textPart.node], slots: [textSlot] };
  }
}
