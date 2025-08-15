import type {
  DirectiveType,
  HydrationTree,
  Part,
  TemplateResult,
  UpdateContext,
} from '../internal.js';
import { AbstractTemplate } from './template.js';

export class EmptyTemplate extends AbstractTemplate<readonly []> {
  get arity(): 0 {
    return 0;
  }

  equals(other: DirectiveType<unknown>): boolean {
    return other instanceof EmptyTemplate;
  }

  hydrate(
    _binds: readonly [],
    _part: Part.ChildNodePart,
    _targetTree: HydrationTree,
    _context: UpdateContext,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }

  render(
    _binds: readonly [],
    _part: Part.ChildNodePart,
    _context: UpdateContext,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }
}
