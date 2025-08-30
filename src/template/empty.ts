import type {
  DirectiveType,
  HydrationTarget,
  Part,
  TemplateResult,
  UpdateSession,
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
    _target: HydrationTarget,
    _session: UpdateSession,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }

  render(
    _binds: readonly [],
    _part: Part.ChildNodePart,
    _session: UpdateSession,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  }
}
