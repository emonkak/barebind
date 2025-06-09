import type {
  DirectiveContext,
  Template,
  TemplateBlock,
  UpdateContext,
} from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import type { HydrationTree } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from './template.js';

export const EmptyTemplate: Template<readonly []> = {
  name: 'EmptyTemplate',
  render(
    _binds: readonly [],
    _part: ChildNodePart,
    _context: DirectiveContext,
  ): typeof EmptyTemplateBlock {
    return EmptyTemplateBlock;
  },
  hydrate(
    _binds: readonly [],
    _part: ChildNodePart,
    _hydrationTree: HydrationTree,
    _context: UpdateContext,
  ): typeof EmptyTemplateBlock {
    return EmptyTemplateBlock;
  },
  resolveBinding(
    binds: readonly [],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly []> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'EmptyTemplate must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(binds)),
      );
    }
    return new TemplateBinding(this, binds, part);
  },
};

export const EmptyTemplateBlock: TemplateBlock<readonly []> = {
  reconcile(_binds: readonly [], _context: UpdateContext): void {},
  connect(_context: UpdateContext): void {},
  disconnect(_context: UpdateContext): void {},
  commit(): void {},
  rollback(): void {},
  mount(_part: ChildNodePart): void {},
  unmount(_part: ChildNodePart): void {},
};
