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

export type ElementTemplateOptions = ElementCreationOptions & {
  namespace?: string;
};

export class ElementTemplate<TElementValue, TChildValue>
  implements Template<readonly [TElementValue, TChildValue]>
{
  private readonly _type: string;

  private readonly _options: ElementTemplateOptions;

  constructor(type: string, options: ElementTemplateOptions = {}) {
    this._type = type;
    this._options = options;
  }

  get type(): string {
    return this._type;
  }

  get options(): ElementTemplateOptions {
    return this._options;
  }

  render(
    data: readonly [TElementValue, TChildValue],
    context: DirectiveContext,
  ): ElementTemplateView<TElementValue, TChildValue> {
    const [elementValue, childValue] = data;
    const elementPart = {
      type: PartType.Element,
      node: createElement(this._type, this._options),
    } as const;
    const childPart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;

    DEBUG: {
      childPart.node.data = nameOf(childValue);
    }

    elementPart.node.appendChild(childPart.node);

    const elementBinding = resolveBinding(elementValue, elementPart, context);
    const childBinding = resolveBinding(childValue, childPart, context);

    return new ElementTemplateView(elementBinding, childBinding);
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return other === this;
  }
}

export class ElementTemplateView<TElementValue, TChildValue>
  implements TemplateView<readonly [TElementValue, TChildValue]>
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
    data: readonly [TElementValue, TChildValue],
    context: UpdateContext,
  ): void {
    const [elementValue, childValue] = data;
    DEBUG: {
      (this._childBinding.part as ChildNodePart).node.data = nameOf(childValue);
    }
    this._elementBinding.bind(elementValue, context);
    this._childBinding.bind(childValue, context);
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

function createElement(
  type: string,
  { namespace, ...restOptions }: ElementTemplateOptions,
): Element {
  return namespace !== undefined
    ? document.createElementNS(namespace, type, restOptions)
    : document.createElement(type, restOptions);
}
