import type {
  DirectiveType,
  Part,
  TemplateResult,
  UpdateSession,
} from '../internal.js';
import { AbstractTemplate } from './template.js';

export class EmptyTemplate extends AbstractTemplate<readonly []> {
  static readonly instance: EmptyTemplate = new EmptyTemplate();

  get arity(): 0 {
    return 0;
  }

  equals(other: DirectiveType<unknown>): boolean {
    return other instanceof EmptyTemplate;
  }

  hydrate(
    _binds: readonly [],
    _part: Part.ChildNodePart,
    _treeWalker: TreeWalker,
    _session: UpdateSession,
  ): TemplateResult {
    return { children: [], slots: [] };
  }

  render(
    _binds: readonly [],
    _part: Part.ChildNodePart,
    _session: UpdateSession,
  ): TemplateResult {
    return { children: [], slots: [] };
  }
}
