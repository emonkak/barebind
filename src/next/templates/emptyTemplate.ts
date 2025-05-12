import type {
  DirectiveContext,
  EffectContext,
  Template,
  TemplateInstance,
  UpdateContext,
} from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from '../template.js';

export const EmptyTemplate: Template<readonly [], ChildNodePart> = {
  render(
    _binds: readonly [],
    _context: DirectiveContext,
  ): typeof EmptyTemplateInstance {
    return EmptyTemplateInstance;
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

export const EmptyTemplateInstance: TemplateInstance<
  readonly [],
  ChildNodePart
> = {
  connect(_context: UpdateContext): void {},
  bind(_binds: readonly [], _context: UpdateContext): void {},
  unbind(_context: UpdateContext): void {},
  disconnect(_context: UpdateContext): void {},
  mount(_part: ChildNodePart, _context: EffectContext): void {},
  unmount(_part: ChildNodePart, _context: EffectContext): void {},
  update(_part: ChildNodePart, _context: EffectContext): void {},
};
