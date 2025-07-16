import type { DirectiveType, TemplateResult, UpdateContext } from '../core.js';
import type { HydrationTree } from '../hydration.js';
import type { ChildNodePart } from '../part.js';
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
    _part: ChildNodePart,
    _hydrationTree: HydrationTree,
    _context: UpdateContext,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }

  render(
    _binds: readonly [],
    _part: ChildNodePart,
    _context: UpdateContext,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }
}
