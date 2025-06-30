import { inspectPart, markUsedValue } from '../debug.js';
import type {
  DirectiveContext,
  Template,
  TemplateResult,
  UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from './template.js';

export const EmptyTemplate = {
  name: 'EmptyTemplate',
  hydrate(
    _binds: readonly [],
    _part: ChildNodePart,
    _hydrationTree: HydrationTree,
    _context: UpdateContext,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  },
  render(
    _binds: readonly [],
    _part: ChildNodePart,
    _context: UpdateContext,
  ): TemplateResult {
    return { childNodes: [], slots: [] };
  },
  resolveBinding(
    binds: readonly [],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly []> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'EmptyTemplate must be used in a child node part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(binds)),
      );
    }
    return new TemplateBinding(this, binds, part);
  },
} as const satisfies Template<readonly []>;
