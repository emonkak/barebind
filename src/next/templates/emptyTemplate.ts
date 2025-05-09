import {
  type DirectiveProtocol,
  type EffectProtocol,
  type Template,
  type TemplateInstance,
  type UpdateProtocol,
  resolveBindingTag,
} from '../coreTypes.js';
import type { ChildNodePart } from '../part.js';
import { TemplateBinding } from '../template.js';

export const EmptyTemplate: Template<readonly []> = {
  render(
    _binds: readonly [],
    _context: DirectiveProtocol,
  ): typeof EmptyTemplateInstance {
    return EmptyTemplateInstance;
  },
  [resolveBindingTag](
    binds: readonly [],
    part: ChildNodePart,
    _context: DirectiveProtocol,
  ): TemplateBinding<readonly []> {
    return new TemplateBinding(this, binds, part);
  },
};

export const EmptyTemplateInstance: TemplateInstance<readonly []> = {
  connect(_context: UpdateProtocol): void {},
  bind(_binds: readonly [], _context: UpdateProtocol): void {},
  unbind(_context: UpdateProtocol): void {},
  mount(_part: ChildNodePart): void {},
  unmount(_part: ChildNodePart): void {},
  disconnect(_context: UpdateProtocol): void {},
  commit(_context: EffectProtocol): void {},
};
