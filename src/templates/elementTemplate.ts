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

export interface ElementData<TElementValue, TChildValue> {
  elementValue: TElementValue;
  childValue: TChildValue;
}

export class ElementTemplate<TElementValue, TChildValue>
  implements Template<ElementData<TElementValue, TChildValue>>
{
  private readonly _type: string;

  constructor(type: string) {
    this._type = type;
  }

  render(
    data: ElementData<TElementValue, TChildValue>,
    context: DirectiveContext,
  ): ElementTemplateView<TElementValue, TChildValue> {
    const elementPart = {
      type: PartType.Element,
      node: document.createElement(this._type),
    } as const;
    const childPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;

    DEBUG: {
      childPart.node.data = nameOf(data.childValue);
    }

    elementPart.node.appendChild(childPart.node);

    const elementBinding = resolveBinding(
      data.elementValue,
      elementPart,
      context,
    );
    const childBinding = resolveBinding(data.childValue, childPart, context);

    return new ElementTemplateView(elementBinding, childBinding);
  }

  isSameTemplate(
    other: Template<ElementData<TElementValue, TChildValue>>,
  ): boolean {
    return (
      other === this ||
      (other instanceof ElementTemplate && other._type === this._type)
    );
  }
}

export class ElementTemplateView<TElementValue, TChildValue>
  implements TemplateView<ElementData<TElementValue, TChildValue>>
{
  private readonly _elementBinding: Binding<TElementValue>;

  private readonly _childBinding: Binding<TChildValue>;

  constructor(
    elementBinding: Binding<TElementValue>,
    childBinding: Binding<TChildValue>,
  ) {
    this._elementBinding = elementBinding;
    this._childBinding = childBinding;
  }

  get elementBinding(): Binding<TElementValue> {
    return this._elementBinding;
  }

  get childBinding(): Binding<TChildValue> {
    return this._childBinding;
  }

  get startNode(): ChildNode {
    return this._elementBinding.startNode;
  }

  get endNode(): ChildNode {
    return this._elementBinding.endNode;
  }

  connect(context: UpdateContext): void {
    this._elementBinding.connect(context);
    this._childBinding.connect(context);
  }

  bind(
    data: ElementData<TElementValue, TChildValue>,
    context: UpdateContext,
  ): void {
    this._elementBinding.bind(data.elementValue, context);
    this._childBinding.bind(data.childValue, context);
  }

  unbind(context: UpdateContext) {
    this._elementBinding.unbind(context);
    this._childBinding.unbind(context);
  }

  disconnect(context: UpdateContext): void {
    this._elementBinding.disconnect(context);
    this._childBinding.disconnect(context);
  }

  mount(part: ChildNodePart): void {
    const referenceNode = part.node;
    const element = this._elementBinding.part.node;
    referenceNode.before(element);
  }

  unmount(_part: ChildNodePart): void {
    const { node } = this._elementBinding.part;
    node.remove();
  }
}
