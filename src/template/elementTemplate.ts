import {
  type Binding,
  type ChildNodePart,
  PartType,
  type Template,
  type TemplateFragment,
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
    context: UpdateContext<unknown>,
  ): ElementTemplateFragment<TElementValue, TChildNodeValue> {
    return new ElementTemplateFragment(this._type, data, context);
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

export class ElementTemplateFragment<TElementValue, TChildNodeValue>
  implements TemplateFragment<ElementData<TElementValue, TChildNodeValue>>
{
  private readonly _elementBinding: Binding<TElementValue>;

  private readonly _childNodeBinding: Binding<TChildNodeValue>;

  constructor(
    type: string,
    data: ElementData<TElementValue, TChildNodeValue>,
    context: UpdateContext<unknown>,
  ) {
    const elementPart = {
      type: PartType.Element,
      node: document.createElement(type),
    } as const;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;

    DEBUG: {
      childNodePart.node.data = nameOf(data.childNodeValue);
    }

    elementPart.node.appendChild(childNodePart.node);

    this._elementBinding = resolveBinding(
      data.elementValue,
      elementPart,
      context,
    );
    this._childNodeBinding = resolveBinding(
      data.childNodeValue,
      childNodePart,
      context,
    );
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

  connect(context: UpdateContext<unknown>): void {
    this._elementBinding.connect(context);
    this._childNodeBinding.connect(context);
  }

  bind(
    data: ElementData<TElementValue, TChildNodeValue>,
    context: UpdateContext<unknown>,
  ): void {
    this._elementBinding.bind(data.elementValue, context);
    this._childNodeBinding.bind(data.childNodeValue, context);
  }

  unbind(context: UpdateContext<unknown>) {
    this._elementBinding.unbind(context);
    this._childNodeBinding.unbind(context);
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

  disconnect(): void {
    this._elementBinding.disconnect();
    this._childNodeBinding.disconnect();
  }
}
