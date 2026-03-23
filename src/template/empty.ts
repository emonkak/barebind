import type { DirectiveType, Part, Session } from '../core.js';
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
    _part: Part.ChildNodePart,
    _hydrationTarget: TreeWalker,
    _session: Session,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }

  render(
    _exprs: readonly [],
    _part: Part.ChildNodePart,
    _session: Session,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }
}
