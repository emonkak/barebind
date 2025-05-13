import type {
  Binding,
  DirectiveContext,
  EffectContext,
  Template,
  TemplateBlock,
  UpdateContext,
} from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
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
        'Template directive must be used in a child node, but it is used here in:\n' +
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
  private _pendingBinding: Binding<T>;

  private _memoizedBinding: Binding<T> | null = null;

  constructor(binding: Binding<T>) {
    this._pendingBinding = binding;
  }

  connect(context: UpdateContext): void {
    this._pendingBinding.connect(context);
  }

  bind(values: readonly [T], context: UpdateContext): void {
    this._pendingBinding = context.reconcileBinding(
      this._pendingBinding,
      values[0],
    );
  }

  disconnect(context: UpdateContext): void {
    this._memoizedBinding?.disconnect(context);
  }

  commit(context: EffectContext): void {
    if (this._pendingBinding !== this._memoizedBinding) {
      this._memoizedBinding?.rollback(context);
    }

    DEBUG: {
      if (this._pendingBinding.part.type === PartType.ChildNode) {
        this._pendingBinding.part.node.data =
          this._pendingBinding.directive.name;
      }
    }

    this._pendingBinding.commit(context);
    this._memoizedBinding = this._pendingBinding;
  }

  rollback(context: EffectContext): void {
    this._memoizedBinding?.rollback(context);

    DEBUG: {
      if (this._pendingBinding.part.type === PartType.ChildNode) {
        this._pendingBinding.part.node.data = '';
      }
    }

    this._memoizedBinding = null;
  }

  mount(part: ChildNodePart): void {
    part.node.before(this._pendingBinding.part.node);
  }

  unmount(_part: ChildNodePart): void {
    this._pendingBinding.part.node.remove();
  }
}
