import {
  type Binding,
  type ChildNodePart,
  type DirectiveContext,
  PartType,
  type Template,
  type TemplateView,
  type UpdateContext,
  nameOf,
} from '../baseTypes.js';
import { resolveBinding } from '../binding.js';

export interface ElementData<TElementValue, TChildNodeValue> {
  elementValue: TElementValue;
  childNodeValue: TChildNodeValue;
}

export class ElementTemplate<TElementValue, TChildNodeValue>
  implements Template<ElementData<TElementValue, TChildNodeValue>>
{
  private readonly _type: string;

  constructor(type: string) {
    this._type = type;
  }

  render(
    data: ElementData<TElementValue, TChildNodeValue>,
    context: DirectiveContext,
  ): ElementTemplateView<TElementValue, TChildNodeValue> {
    const elementPart = {
      type: PartType.Element,
      node: document.createElement(this._type),
    } as const;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;

    DEBUG: {
      childNodePart.node.data = nameOf(data.childNodeValue);
    }

    elementPart.node.appendChild(childNodePart.node);

    const elementBinding = resolveBinding(
      data.elementValue,
      elementPart,
      context,
    );
    const childNodeBinding = resolveBinding(
      data.childNodeValue,
      childNodePart,
      context,
    );

    return new ElementTemplateView(elementBinding, childNodeBinding);
  }

  isSameTemplate(
    other: Template<ElementData<TElementValue, TChildNodeValue>>,
  ): boolean {
    return (
      other === this ||
      (other instanceof ElementTemplate && other._type === this._type)
    );
  }
}

export class ElementTemplateView<TElementValue, TChildNodeValue>
  implements TemplateView<ElementData<TElementValue, TChildNodeValue>>
{
  private readonly _elementBinding: Binding<TElementValue>;

  private readonly _childNodeBinding: Binding<TChildNodeValue>;

  constructor(
    elementBinding: Binding<TElementValue>,
    childNodeBinding: Binding<TChildNodeValue>,
  ) {
    this._elementBinding = elementBinding;
    this._childNodeBinding = childNodeBinding;
  }

  get elementBinding(): Binding<TElementValue> {
    return this._elementBinding;
  }

  get childNodeBinding(): Binding<TChildNodeValue> {
    return this._childNodeBinding;
  }

  get startNode(): ChildNode {
    return this._elementBinding.startNode;
  }

  get endNode(): ChildNode {
    return this._elementBinding.endNode;
  }

  connect(context: UpdateContext): void {
    this._elementBinding.connect(context);
    this._childNodeBinding.connect(context);
  }

  bind(
    data: ElementData<TElementValue, TChildNodeValue>,
    context: UpdateContext,
  ): void {
    this._elementBinding.bind(data.elementValue, context);
    this._childNodeBinding.bind(data.childNodeValue, context);
  }

  unbind(context: UpdateContext) {
    this._elementBinding.unbind(context);
    this._childNodeBinding.unbind(context);
  }

  disconnect(context: UpdateContext): void {
    this._elementBinding.disconnect(context);
    this._childNodeBinding.disconnect(context);
  }

  mount(part: ChildNodePart): void {
    const referenceNode = part.node;
    const element = this._elementBinding.part.node;

    referenceNode.before(element);
  }

  unmount(part: ChildNodePart): void {
    const { parentNode } = part.node;

    if (parentNode !== null) {
      const element = this._elementBinding.part.node;

      parentNode.removeChild(element);
    }
  }
}
