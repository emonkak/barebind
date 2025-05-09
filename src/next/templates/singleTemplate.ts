import {
  type Binding,
  type DirectiveProtocol,
  type EffectProtocol,
  type Template,
  type TemplateInstance,
  type UpdateProtocol,
  resolveBindingTag,
} from '../coreTypes.js';
import { nameOf } from '../debug.js';
import { type ChildNodePart, PartType } from '../part.js';
import { TemplateBinding } from '../template.js';

export const ChildTemplate: Template<readonly [unknown]> = {
  render(
    binds: readonly [unknown],
    context: DirectiveProtocol,
  ): SingleTemplateInstance<unknown> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const binding = context.resolveBinding(binds[0], part);
    DEBUG: {
      part.node.data = nameOf(binds[0]);
    }
    return new SingleTemplateInstance(binding);
  },
  [resolveBindingTag](
    binds: readonly [unknown],
    part: ChildNodePart,
    _context: DirectiveProtocol,
  ): TemplateBinding<readonly [unknown]> {
    return new TemplateBinding(this, binds, part);
  },
};

export const TextTemplate: Template<readonly [unknown]> = {
  render(
    binds: readonly [unknown],
    context: DirectiveProtocol,
  ): SingleTemplateInstance<unknown> {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const value = binds[0];
    const binding = context.resolveBinding(value, part);
    return new SingleTemplateInstance(binding);
  },
  [resolveBindingTag](
    binds: readonly [unknown],
    part: ChildNodePart,
    _context: DirectiveProtocol,
  ): TemplateBinding<readonly [unknown]> {
    return new TemplateBinding(this, binds, part);
  },
};

export class SingleTemplateInstance<T>
  implements TemplateInstance<readonly [T]>
{
  private readonly _binding: Binding<T>;

  constructor(binding: Binding<T>) {
    this._binding = binding;
  }

  get binding(): Binding<T> {
    return this._binding;
  }

  connect(context: UpdateProtocol): void {
    this._binding.connect(context);
  }

  bind(values: readonly [T], context: UpdateProtocol): void {
    const binding = this._binding;
    DEBUG: {
      if (binding.part.type === PartType.ChildNode) {
        binding.part.node.data = nameOf(values[0]);
      }
    }
    binding.bind(values[0], context);
  }

  unbind(context: UpdateProtocol): void {
    this._binding.unbind(context);
  }

  disconnect(context: UpdateProtocol): void {
    this._binding.disconnect(context);
  }

  commit(context: EffectProtocol): void {
    this._binding.commit(context);
  }

  mount(part: ChildNodePart): void {
    part.node.before(this._binding.part.node);
  }

  unmount(_part: ChildNodePart): void {
    this._binding.part.node.remove();
  }
}
