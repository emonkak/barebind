import { inspectPart, markUsedValue } from '../debug.js';
import type {
  Binding,
  DirectiveContext,
  Template,
  TemplateBlock,
  UpdateContext,
} from '../directive.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from '../template.js';

export const ChildNodeTemplate: Template<readonly [unknown], ChildNodePart> = {
  get name(): string {
    return 'ChildNodeTemplate';
  },
  render(
    binds: readonly [unknown],
    context: DirectiveContext,
  ): SingleTemplateBlock<unknown> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const binding = context.resolveBinding(binds[0], part);
    DEBUG: {
      part.node.data = binding.directive.name;
    }
    return new SingleTemplateBlock(binding);
  },
  resolveBinding(
    binds: readonly [unknown],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [unknown], ChildNodePart> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'Single template must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new TemplateBinding(this, binds, part);
  },
};

export const TextTemplate: Template<readonly [unknown], ChildNodePart> = {
  get name(): string {
    return 'TextTemplate';
  },
  render(
    binds: readonly [unknown],
    context: DirectiveContext,
  ): SingleTemplateBlock<unknown> {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const value = binds[0];
    const binding = context.resolveBinding(value, part);
    return new SingleTemplateBlock(binding);
  },
  resolveBinding(
    binds: readonly [unknown],
    part: ChildNodePart,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [unknown], ChildNodePart> {
    return new TemplateBinding(this, binds, part);
  },
};

export class SingleTemplateBlock<T>
  implements TemplateBlock<readonly [T], ChildNodePart>
{
  private _binding: Binding<T>;

  constructor(binding: Binding<T>) {
    this._binding = binding;
  }

  bind(binds: readonly [T], context: UpdateContext): void {
    this._binding.bind(binds[0], context);
  }

  connect(context: UpdateContext): void {
    this._binding.connect(context);
  }

  disconnect(context: UpdateContext): void {
    this._binding.disconnect(context);
  }

  commit(): void {
    DEBUG: {
      if (this._binding.part.type === PartType.ChildNode) {
        this._binding.part.node.data = this._binding.directive.name;
      }
    }
    this._binding.commit();
  }

  rollback(): void {
    this._binding.rollback();
  }

  mount(part: ChildNodePart): void {
    part.node.before(this._binding.part.node);
  }

  unmount(_part: ChildNodePart): void {
    this._binding.part.node.remove();
  }
}
