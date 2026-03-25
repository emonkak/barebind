import type { DirectiveType, Session } from '../core.js';
import type { DOMPart } from '../dom.js';
import { Template, type TemplateResult } from './template.js';

export class EmptyTemplate extends Template<readonly []> {
  static readonly Default: EmptyTemplate = new EmptyTemplate();

  get arity(): 0 {
    return 0;
  }

  equals(other: DirectiveType<unknown>): boolean {
    return other instanceof EmptyTemplate;
  }

  hydrate(
    _exprs: readonly [],
    _part: DOMPart.ChildNodePart,
    _hydrationTarget: TreeWalker,
    _session: Session,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }

  render(
    _exprs: readonly [],
    _part: DOMPart.ChildNodePart,
    _session: Session,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }
}
