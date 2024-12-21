import {
  type Binding,
  type ChildNodePart,
  type DirectiveContext,
  PartType,
  type Template,
  type TemplateView,
  type UpdateContext,
  resolveBinding,
} from '../baseTypes.js';
import { nameOf } from '../debug.js';
import { EagerTemplateResult } from '../directives/templateResult.js';

export class ChildTemplate<T> implements Template<readonly [T]> {
  render(
    values: readonly [T],
    context: DirectiveContext,
  ): ValueTemplateView<T> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const value = values[0];
    const binding = resolveBinding(value, part, context);
    DEBUG: {
      part.node.data = nameOf(value);
    }
    return new ValueTemplateView(binding);
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return this === other;
  }

  wrapInResult(values: readonly [T]): EagerTemplateResult<readonly [T]> {
    return new EagerTemplateResult(this, values);
  }
}

export class TextTemplate<T> implements Template<readonly [T]> {
  render(
    values: readonly [T],
    context: DirectiveContext,
  ): ValueTemplateView<T> {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const binding = resolveBinding(values[0], part, context);
    return new ValueTemplateView(binding);
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return this === other;
  }

  wrapInResult(values: readonly [T]): EagerTemplateResult<readonly [T]> {
    return new EagerTemplateResult(this, values);
  }
}

export class ValueTemplateView<T> implements TemplateView<readonly [T]> {
  private readonly _binding: Binding<T>;

  constructor(binding: Binding<T>) {
    this._binding = binding;
  }

  get startNode(): ChildNode {
    return this._binding.startNode;
  }

  get endNode(): ChildNode {
    return this._binding.endNode;
  }

  get binding(): Binding<T> {
    return this._binding;
  }

  connect(context: UpdateContext): void {
    this._binding.connect(context);
  }

  bind(values: readonly [T], context: UpdateContext): void {
    const binding = this._binding;
    DEBUG: {
      if (binding.part.type === PartType.ChildNode) {
        binding.part.node.data = nameOf(values[0]);
      }
    }
    binding.bind(values[0], context);
  }

  unbind(context: UpdateContext): void {
    this._binding.unbind(context);
  }

  disconnect(context: UpdateContext): void {
    this._binding.disconnect(context);
  }

  mount(part: ChildNodePart): void {
    const referenceNode = part.node;
    referenceNode.before(this._binding.part.node);
  }

  unmount(_part: ChildNodePart): void {
    const { node } = this._binding.part;
    node.remove();
  }
}
