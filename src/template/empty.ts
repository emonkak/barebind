import type {
  DirectiveType,
  NodeScanner,
  Part,
  TemplateResult,
  UpdateContext,
} from '../core.js';
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
    _nodeScanner: NodeScanner,
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
