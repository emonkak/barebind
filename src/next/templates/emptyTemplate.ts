import type {
  DirectiveContext,
  Template,
  TemplateBlock,
  UpdateContext,
} from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from '../template.js';

export const EmptyTemplate: Template<readonly [], ChildNodePart> = {
  get name(): string {
    return 'EmptyTemplate';
  },
  render(
    _binds: readonly [],
    _context: DirectiveContext,
  ): typeof EmptyTemplateBlock {
    return EmptyTemplateBlock;
  },
  resolveBinding(
    binds: readonly [],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [], ChildNodePart> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'Template directive must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new TemplateBinding(this, binds, part);
  },
};

export const EmptyTemplateBlock: TemplateBlock<readonly [], ChildNodePart> = {
  connect(_context: UpdateContext): void {},
  bind(_binds: readonly [], _context: UpdateContext): void {},
  disconnect(_context: UpdateContext): void {},
  commit(): void {},
  rollback(): void {},
  mount(_part: ChildNodePart): void {},
  unmount(_part: ChildNodePart): void {},
};
