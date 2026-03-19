import type {
  DirectiveType,
  Part,
  TemplateResult,
  UpdateSession,
} from '../core.js';
import { AbstractTemplate } from './template.js';

export class EmptyTemplate extends AbstractTemplate<readonly []> {
  static readonly Default: EmptyTemplate = new EmptyTemplate();

  get arity(): 0 {
    return 0;
  }

  equals(other: DirectiveType<unknown>): boolean {
    return other instanceof EmptyTemplate;
  }

  hydrate(
    _values: readonly [],
    _part: Part.ChildNodePart,
    _hydrationTarget: TreeWalker,
    _session: UpdateSession,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }

  render(
    _values: readonly [],
    _part: Part.ChildNodePart,
    _session: UpdateSession,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }
}
