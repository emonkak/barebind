import { type Binding, resolveBinding } from '../binding.js';
import {
  type ChildNodePart,
  PartType,
  type Template,
  type TemplateFragment,
  type Updater,
} from '../types.js';

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

  hydrate(
    data: ElementData<TElementValue, TChildNodeValue>,
    updater: Updater<unknown>,
  ): ElementTemplateFragment<TElementValue, TChildNodeValue> {
    const { elementValue, childNodeValue } = data;
    const elementPart = {
      type: PartType.Element,
      node: document.createElement(this._type),
    } as const;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const elementBinding = resolveBinding(elementValue, elementPart, updater);
    const childNodeBinding = resolveBinding(
      childNodeValue,
      childNodePart,
      updater,
    );
    elementBinding.connect(updater);
    childNodeBinding.connect(updater);
    return new ElementTemplateFragment(elementBinding, childNodeBinding);
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

  attach(
    newData: ElementData<TElementValue, TChildNodeValue>,
    updater: Updater<unknown>,
  ): void {
    this._elementBinding.bind(newData.elementValue, updater);
    this._childNodeBinding.bind(newData.childNodeValue, updater);
  }

  detach(updater: Updater): void {
    this._elementBinding.unbind(updater);
    this._childNodeBinding.unbind(updater);
  }

  mount(part: ChildNodePart): void {
    const referenceNode = part.node;
    const element = this._elementBinding.part.node;
    const childNode = this._childNodeBinding.part.node;

    element.appendChild(childNode);
    referenceNode.before(element);
  }

  unmount(part: ChildNodePart): void {
    const { parentNode } = part.node;

    if (parentNode !== null) {
      const element = this._elementBinding.part.node;
      const childNode = this._childNodeBinding.part.node;

      parentNode.removeChild(element);
      element.removeChild(childNode);
    }
  }

  disconnect(): void {
    this._elementBinding.disconnect();
    this._childNodeBinding.disconnect();
  }
}
