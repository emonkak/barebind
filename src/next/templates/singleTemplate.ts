import {
  type Binding,
  type DirectiveContext,
  type EffectContext,
  type Template,
  type TemplateInstance,
  type UpdateContext,
  resolveBindingTag,
} from '../coreTypes.js';
import { inspectValue } from '../debug.js';
import { type ChildNodePart, PartType } from '../part.js';
import { TemplateBinding } from '../template.js';

export const ChildNodeTemplate: Template<readonly [unknown]> = {
  render(
    binds: readonly [unknown],
    context: DirectiveContext,
  ): SingleTemplateInstance<unknown> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const binding = context.resolveBinding(binds[0], part);
    DEBUG: {
      part.node.data = inspectValue(binds[0]);
    }
    return new SingleTemplateInstance(binding);
  },
  [resolveBindingTag](
    binds: readonly [unknown],
    part: ChildNodePart,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [unknown]> {
    return new TemplateBinding(this, binds, part);
  },
};

export const TextTemplate: Template<readonly [unknown]> = {
  render(
    binds: readonly [unknown],
    context: DirectiveContext,
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
    _context: DirectiveContext,
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

  connect(context: UpdateContext): void {
    this._binding.connect(context);
  }

  bind(values: readonly [T], context: UpdateContext): void {
    this._binding.bind(values[0], context);
  }

  unbind(context: UpdateContext): void {
    this._binding.unbind(context);
  }

  disconnect(context: UpdateContext): void {
    this._binding.disconnect(context);
  }

  commit(context: EffectContext): void {
    DEBUG: {
      if (this._binding.part.type === PartType.ChildNode) {
        this._binding.part.node.data = inspectValue(this._binding.value);
      }
    }
    this._binding.commit(context);
  }

  mount(part: ChildNodePart): void {
    part.node.before(this._binding.part.node);
  }

  unmount(_part: ChildNodePart): void {
    this._binding.part.node.remove();
  }
}
