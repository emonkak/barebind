import {
  type Binding,
  type ChildNodePart,
  type DirectiveContext,
  PartType,
  type Template,
  type TemplateView,
  type UpdateContext,
  nameOf,
  resolveBinding,
} from '../baseTypes.js';

export class ChildValueTemplate<T> implements Template<T> {
  static readonly instance = new ChildValueTemplate<any>();

  private constructor() {
    if (ChildValueTemplate.instance !== undefined) {
      throw new Error(
        'ChildValueTemplate constructor cannot be called directly.',
      );
    }
  }

  render(data: T, context: DirectiveContext): SingleTemplateView<T> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const binding = resolveBinding(data, part, context);
    DEBUG: {
      part.node.nodeValue = nameOf(data);
    }
    return new SingleTemplateView(binding);
  }

  isSameTemplate(other: Template<T>): boolean {
    return other === this;
  }
}

export class TextTemplate<T> implements Template<T> {
  static readonly instance = new TextTemplate<any>();

  private constructor() {
    if (TextTemplate.instance !== undefined) {
      throw new Error('TextTemplate constructor cannot be called directly.');
    }
  }

  render(data: T, context: DirectiveContext): SingleTemplateView<T> {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const binding = resolveBinding(data, part, context);
    return new SingleTemplateView(binding);
  }

  isSameTemplate(other: Template<T>): boolean {
    return other === this;
  }
}

export class SingleTemplateView<T> implements TemplateView<T> {
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

  bind(data: T, context: UpdateContext): void {
    this._binding.bind(data, context);
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
