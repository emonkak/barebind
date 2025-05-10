import {
  type DirectiveContext,
  type EffectContext,
  type Template,
  type TemplateInstance,
  type UpdateContext,
  resolveBindingTag,
} from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from '../template.js';

export const EmptyTemplate: Template<readonly []> = {
  render(
    _binds: readonly [],
    _context: DirectiveContext,
  ): typeof EmptyTemplateInstance {
    return EmptyTemplateInstance;
  },
  [resolveBindingTag](
    binds: readonly [],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly []> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'Template directive must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new TemplateBinding(this, binds, part);
  },
};

export const EmptyTemplateInstance: TemplateInstance<readonly []> = {
  connect(_context: UpdateContext): void {},
  bind(_binds: readonly [], _context: UpdateContext): void {},
  unbind(_context: UpdateContext): void {},
  mount(_part: ChildNodePart): void {},
  unmount(_part: ChildNodePart): void {},
  disconnect(_context: UpdateContext): void {},
  commit(_context: EffectContext): void {},
};
