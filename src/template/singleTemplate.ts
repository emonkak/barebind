import { resolveBinding } from '../binding.js';
import {
  type Binding,
  type ChildNodePart,
  PartType,
  type Template,
  type TemplateFragment,
  type UpdateContext,
  nameOf,
} from '../types.js';

export class ChildNodeTemplate<T> implements Template<T> {
  static readonly instance: ChildNodeTemplate<any> =
    new ChildNodeTemplate<any>();

  private constructor() {
    if (ChildNodeTemplate.instance !== undefined) {
      throw new Error(
        'ChildNodeTemplate constructor cannot be called directly.',
      );
    }
  }

  render(data: T, context: UpdateContext<unknown>): SingleTemplateFragment<T> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    DEBUG: {
      part.node.nodeValue = nameOf(data);
    }
    const binding = resolveBinding(data, part, context);
    binding.connect(context);
    return new SingleTemplateFragment(binding);
  }

  isSameTemplate(other: Template<T>): boolean {
    return other === this;
  }
}

export class TextTemplate<T> implements Template<T> {
  static readonly instance: TextTemplate<any> = new TextTemplate<any>();

  private constructor() {
    if (TextTemplate.instance !== undefined) {
      throw new Error('TextTemplate constructor cannot be called directly.');
    }
  }

  render(data: T, context: UpdateContext<unknown>): SingleTemplateFragment<T> {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const binding = resolveBinding(data, part, context);
    binding.connect(context);
    return new SingleTemplateFragment(binding);
  }

  isSameTemplate(other: Template<T>): boolean {
    return other === this;
  }
}

export class SingleTemplateFragment<T> implements TemplateFragment<T> {
  private readonly _binding: Binding<T>;

  constructor(binding: Binding<T>) {
    this._binding = binding;
  }

  get binding(): Binding<T> {
    return this._binding;
  }

  get startNode(): ChildNode {
    return this._binding.startNode;
  }

  get endNode(): ChildNode {
    return this._binding.endNode;
  }

  bind(data: T, context: UpdateContext<unknown>): void {
    this._binding.bind(data, context);
  }

  unbind(context: UpdateContext<unknown>): void {
    this._binding.unbind(context);
  }

  mount(part: ChildNodePart): void {
    const referenceNode = part.node;
    referenceNode.before(this._binding.part.node);
  }

  unmount(part: ChildNodePart): void {
    part.node.parentNode?.removeChild(this._binding.part.node);
  }

  disconnect(): void {
    this._binding.disconnect();
  }
}
