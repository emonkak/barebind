import type {
  Binding,
  DirectiveContext,
  EffectContext,
  Template,
  TemplateInstance,
  UpdateContext,
} from '../coreTypes.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from '../template.js';

export const ChildNodeTemplate: Template<readonly [unknown], ChildNodePart> = {
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
  resolveBinding(
    binds: readonly [unknown],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [unknown], ChildNodePart> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'Template directive must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new TemplateBinding(this, binds, part);
  },
};

export const TextTemplate: Template<readonly [unknown], ChildNodePart> = {
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
  resolveBinding(
    binds: readonly [unknown],
    part: ChildNodePart,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [unknown], ChildNodePart> {
    return new TemplateBinding(this, binds, part);
  },
};

export class SingleTemplateInstance<T>
  implements TemplateInstance<readonly [T], ChildNodePart>
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

  mount(part: ChildNodePart): void {
    part.node.before(this._binding.part.node);
  }

  unmount(_part: ChildNodePart): void {
    this._binding.part.node.remove();
  }

  commit(context: EffectContext): void {
    DEBUG: {
      if (this._binding.part.type === PartType.ChildNode) {
        this._binding.part.node.data = inspectValue(this._binding.value);
      }
    }
    this._binding.commit(context);
  }
}
