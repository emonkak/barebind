import { defineComponent } from '../component.js';
import { inspectPart, markUsedValue } from '../debug.js';
import {
  $toDirectiveElement,
  type Bindable,
  type Binding,
  type CommitContext,
  type ComponentFunction,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  DirectiveObject,
  isBindable,
  type UpdateContext,
} from '../directive.js';
import { HydrationError, type HydrationTree } from '../hydration.js';
import {
  type ChildNodePart,
  type ElementPart,
  getStartNode,
  type Part,
  PartType,
} from '../part.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { TextPrimitive } from '../primitive/text.js';

const TEXT_NODE = '#text';
const COMMENT_NODE = '#comment';

export type VChild =
  | VChild[]
  | VElement
  | Bindable<unknown>
  | bigint
  | boolean
  | number
  | string
  | symbol
  | null
  | undefined;

interface VNode<T = unknown> {
  directive: Directive<T>;
  value: T;
  nodeType: VNodeType;
}

export type VProps = Record<string, unknown>;

export type VElementType<TProps> = ComponentFunction<TProps> | string;

type VNodeType = typeof TEXT_NODE | typeof COMMENT_NODE | string;

interface VNodeSlot {
  binding: Binding<unknown>;
  dirty: boolean;
}

type EventRegistry = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

type EventListenerWithOptions =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions);

export const VDOMDirective: Directive<VChild[]> = {
  name: 'VDOMDirective',
  resolveBinding(
    children: VChild[],
    part: Part,
    _context: DirectiveContext,
  ): VDOMBinding {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'VDOMDirective must be used in a child node part, but it is used here:\n' +
          inspectPart(part, markUsedValue(children)),
      );
    }
    return new VDOMBinding(children, part);
  },
};

export const VElementDirective: Directive<VElement> = {
  name: 'VElementDirective',
  resolveBinding(
    element: VElement,
    part: Part,
    _context: DirectiveContext,
  ): VElementBinding {
    if (part.type !== PartType.Element) {
      throw new Error(
        'VElementDirective must be used in an element part, but it is used here:\n' +
          inspectPart(part, markUsedValue(element)),
      );
    }
    return new VElementBinding(element, part);
  },
};

export function createElement<const TProps extends VProps>(
  type: VElementType<TProps>,
  props: TProps,
  ...children: VChild[]
): VElement<TProps> {
  return new VElement(type, props, children);
}

export function createFragment(children: VChild[]): DirectiveObject<VChild[]> {
  return new DirectiveObject(VDOMDirective, children);
}

export class VDOMBinding implements Binding<VChild[]> {
  private _children: VChild[];

  private readonly _part: ChildNodePart;

  private _pendingSlots: VNodeSlot[] = [];

  private _memoizedSlots: VNodeSlot[] | null = null;

  constructor(children: VChild[], part: ChildNodePart) {
    this._children = children;
    this._part = part;
  }

  get directive(): Directive<VChild[]> {
    return VDOMDirective;
  }

  get value(): VChild[] {
    return this._children;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  shouldBind(children: VChild[]): boolean {
    return this._memoizedSlots === null || children !== this._children;
  }

  bind(children: VChild[]): void {
    this._children = children;
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    if (this._memoizedSlots !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initilized.',
      );
    }

    const slots: VNodeSlot[] = new Array(this._children.length);
    const document = this._part.node.ownerDocument;

    for (let i = 0, l = this._children.length; i < l; i++) {
      const node = resolveNode(this._children[i]!);
      slots[i] = {
        binding: hydrateNode(node, hydrationTree, document, context),
        dirty: true,
      };
    }

    this._pendingSlots = slots;
  }

  connect(context: UpdateContext): void {
    const newChildren = this._children;
    const newSlots: VNodeSlot[] = new Array(this._children.length);
    const oldSlots = this._pendingSlots;
    const newTail = newChildren.length - 1;
    const oldTail = oldSlots.length - 1;
    const document = this._part.node.ownerDocument;
    let index = 0;

    while (index <= newTail && index <= oldTail) {
      const newNode = resolveNode(newChildren[index]!);
      const oldSlot = oldSlots![index]!;
      newSlots[index] = patchSlot(oldSlot, newNode, context);
      index++;
    }

    while (index <= oldTail) {
      const oldSlot = oldSlots[index]!;
      oldSlot.binding.disconnect(context);
      oldSlot.dirty = true;
      index++;
    }

    while (index <= newTail) {
      const newElement = resolveNode(newChildren[index]!);
      const binding = renderNode(newElement, document, context);
      binding.connect(context);
      newSlots[index] = { binding, dirty: true };
      index++;
    }

    this._pendingSlots = newSlots;
  }

  disconnect(context: UpdateContext): void {
    for (let i = this._pendingSlots.length - 1; i >= 0; i--) {
      const slot = this._pendingSlots[i]!;
      slot.binding.disconnect(context);
      slot.dirty = true;
    }
  }

  commit(context: CommitContext): void {
    const newSlots = this._pendingSlots;
    const oldSlots = this._memoizedSlots;
    const newTail = newSlots.length - 1;
    const oldTail = oldSlots !== null ? oldSlots.length - 1 : -1;
    let index = 0;

    while (index <= newTail && index <= oldTail) {
      const newSlot = newSlots[index]!;
      const oldSlot = oldSlots![index]!;

      if (newSlot !== oldSlot) {
        oldSlot.binding.rollback(context);
        oldSlot.binding.part.node.replaceWith(newSlot.binding.part.node);
      }

      if (newSlot.dirty) {
        newSlot.binding.commit(context);
        newSlot.dirty = false;
      }

      index++;
    }

    while (index <= oldTail) {
      const oldSlot = oldSlots![index]!;
      oldSlot.binding.rollback(context);
      oldSlot.binding.part.node.remove();
      index++;
    }

    while (index <= newTail) {
      const newSlot = newSlots[index]!;
      this._part.node.before(newSlot.binding.part.node);
      newSlot.binding.commit(context);
      newSlot.dirty = false;
      index++;
    }

    this._memoizedSlots = newSlots;
    this._part.childNode =
      newSlots.length > 0 ? getStartNode(newSlots[0]!.binding.part) : null;
  }

  rollback(context: CommitContext): void {
    const slots = this._memoizedSlots;

    if (slots !== null) {
      for (let i = slots.length - 1; i >= 0; i--) {
        const { binding } = slots[i]!;
        binding.rollback(context);
        binding.part.node.remove();
      }
    }

    this._memoizedSlots = null;
    this._part.childNode = null;
  }
}

export class VElement<TProps extends VProps = VProps>
  implements Bindable<VChild[]>
{
  readonly type: VElementType<TProps>;

  readonly props: TProps;

  readonly children: VChild[];

  constructor(type: VElementType<TProps>, props: TProps, children: VChild[]) {
    this.type = type;
    this.props = props;
    this.children = children;
  }

  [$toDirectiveElement](): DirectiveElement<VChild[]> {
    return {
      directive: VDOMDirective,
      value: [this],
    };
  }
}

export class VElementBinding<TProps extends VProps = VProps>
  implements Binding<VElement<TProps>>
{
  private _pendingElement: VElement<TProps>;

  private _memoizedElement: VElement<TProps> | null = null;

  private readonly _part: ElementPart;

  private readonly _children: VDOMBinding;

  private readonly _listenerMap: Map<string, EventListenerWithOptions> =
    new Map();

  constructor(element: VElement<TProps>, part: ElementPart) {
    this._pendingElement = element;
    this._part = part;
    this._children = new VDOMBinding(element.children ?? [], {
      type: PartType.ChildNode,
      node: part.node.ownerDocument.createComment(''),
      childNode: null,
    });
  }

  get directive(): Directive<VElement<TProps>> {
    return VElementDirective as Directive<VElement<TProps>>;
  }

  get value(): VElement<TProps> {
    return this._pendingElement;
  }

  get part(): ElementPart {
    return this._part;
  }

  shouldBind(element: VElement<TProps>): boolean {
    return this._memoizedElement !== element;
  }

  bind(element: VElement<TProps>): void {
    this._pendingElement = element;
    this._children.bind(element.children ?? []);
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    this._children.hydrate(hydrationTree, context);
  }

  connect(context: UpdateContext): void {
    this._children.connect(context);
  }

  disconnect(context: UpdateContext): void {
    this._children.disconnect(context);
  }

  commit(context: CommitContext): void {
    const newProps = this._pendingElement.props ?? ({} as TProps);
    const oldProps = this._memoizedElement?.props ?? ({} as TProps);
    const element = this._part.node;

    for (const key of Object.keys(oldProps)) {
      if (!Object.hasOwn(newProps, key)) {
        removeProperty(element, key, oldProps[key as keyof TProps]!, this);
      }
    }

    for (const key of Object.keys(newProps)) {
      updateProperty(
        element,
        key,
        newProps[key as keyof TProps],
        oldProps[key as keyof TProps],
        this,
      );
    }

    if (this._memoizedElement === null) {
      element.appendChild(this._children.part.node);
    }

    DEBUG: {
      context.debugValue(
        this._children.directive,
        this._children.value,
        this._children.part,
      );
    }

    this._children.commit(context);

    this._memoizedElement = this._pendingElement;
  }

  rollback(context: CommitContext): void {
    const props = this._memoizedElement?.props;
    const element = this._part.node;

    if (props !== undefined) {
      for (const key of Object.keys(props)) {
        removeProperty(element, key, props[key as keyof TProps], this);
      }
    }

    this._children.rollback(context);

    DEBUG: {
      context.undebugValue(
        this._children.directive,
        this._children.value,
        this._children.part,
      );
    }

    if (this._memoizedElement !== undefined) {
      this._children.part.node.remove();
    }

    this._memoizedElement = null;
  }

  addEventListener(type: string, listener: EventListenerWithOptions): void {
    if (!this._listenerMap.has(type)) {
      if (typeof listener === 'function') {
        this._part.node.addEventListener(type, this);
      } else {
        this._part.node.addEventListener(type, this, listener);
      }
    }

    this._listenerMap.set(type, listener);
  }

  removeEventListener(type: string, listener: EventListenerWithOptions): void {
    if (typeof listener === 'function') {
      this._part.node.removeEventListener(type, this);
    } else {
      this._part.node.removeEventListener(type, this, listener);
    }

    this._listenerMap.delete(type);
  }

  handleEvent(event: Event): void {
    const listener = this._listenerMap.get(event.type);

    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener?.handleEvent(event);
    }
  }
}

function createPart(nodeType: VNodeType, document: Document): Part {
  switch (nodeType) {
    case COMMENT_NODE:
      return {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
    case TEXT_NODE:
      return {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
    default:
      return {
        type: PartType.Element,
        node: document.createElement(nodeType),
      };
  }
}

function patchSlot(
  slot: VNodeSlot,
  node: VNode,
  context: UpdateContext,
): VNodeSlot {
  const { binding } = slot;
  if (
    binding.directive === node.directive &&
    getNodeType(binding.part) === node.nodeType.toUpperCase()
  ) {
    if (binding.shouldBind(node.value)) {
      binding.bind(node.value);
      binding.connect(context);
      slot.dirty = true;
    }
    return slot;
  } else {
    binding.disconnect(context);
    const newBinding = renderNode(
      node,
      binding.part.node.ownerDocument,
      context,
    );
    return {
      binding: newBinding,
      dirty: true,
    };
  }
}

function getNodeType(part: Part): VNodeType {
  switch (part.type) {
    case PartType.Text:
      return TEXT_NODE;
    case PartType.ChildNode:
      return COMMENT_NODE;
    default:
      return part.node.nodeName;
  }
}

function hydrateNode(
  node: VNode,
  hydrationTree: HydrationTree,
  document: Document,
  context: UpdateContext,
): Binding<unknown> {
  const { directive, value, nodeType } = node;
  const part = hydratePart(nodeType, hydrationTree, document);
  const binding = directive.resolveBinding(value, part, context);

  binding.hydrate(hydrationTree, context);

  if (part.node.parentNode === null) {
    hydrationTree
      .popNode(part.node.nodeType, part.node.nodeName)
      .replaceWith(part.node);
  }

  return binding;
}

function hydratePart(
  nodeType: VNodeType,
  hydrationTree: HydrationTree,
  document: Document,
): Part {
  switch (nodeType) {
    case COMMENT_NODE:
      return {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
    case TEXT_NODE:
      return {
        type: PartType.Text,
        node: hydrationTree.popNode(Node.TEXT_NODE, TEXT_NODE),
        precedingText: '',
        followingText: '',
      };
    default:
      return {
        type: PartType.Element,
        node: hydrationTree.popNode(Node.ELEMENT_NODE, nodeType.toUpperCase()),
      };
  }
}

function narrowElement<
  const TType extends Uppercase<keyof HTMLElementTagNameMap>,
>(
  element: Element,
  ...expectedTypes: TType[]
): element is HTMLElementTagNameMap[Lowercase<TType>] {
  return (expectedTypes as string[]).includes(element.tagName);
}

function removeProperty(
  element: Element,
  key: string,
  value: unknown,
  target: EventRegistry,
): void {
  switch (key.toLowerCase()) {
    case 'children':
    case 'key':
      // Skip special properties.
      return;
    case 'defaultchecked':
      if (narrowElement(element, 'INPUT')) {
        element.defaultChecked = false;
        return;
      }
      break;
    case 'defaultvalue':
      if (narrowElement(element, 'INPUT', 'OUTPUT', 'TEXTAREA')) {
        element.defaultValue = '';
        return;
      }
      break;
    case 'checked':
      if (narrowElement(element, 'INPUT')) {
        element.checked = element.defaultChecked;
        return;
      }
      break;
    case 'value':
      if (narrowElement(element, 'INPUT', 'OUTPUT', 'TEXTAREA')) {
        element.value = element.defaultValue;
        return;
      } else if (narrowElement(element, 'SELECT')) {
        element.value = '';
        return;
      }
      break;
    default:
      if (key.length > 2 && key.startsWith('on')) {
        target.removeEventListener(
          key.slice(2),
          value as EventListenerWithOptions,
        );
        return;
      }
  }

  element.removeAttribute(key);
}

function renderNode(
  node: VNode,
  document: Document,
  context: UpdateContext,
): Binding<unknown> {
  const { directive, value, nodeType } = node;
  const part = createPart(nodeType, document);
  const binding = directive.resolveBinding(value, part, context);
  binding.connect(context);
  return binding;
}

function resolveNode(child: VChild): VNode {
  if (child == null || typeof child === 'boolean') {
    return {
      directive: BlackholePrimitive,
      value: child,
      nodeType: COMMENT_NODE,
    };
  } else if (Array.isArray(child)) {
    return {
      directive: VDOMDirective,
      value: child,
      nodeType: COMMENT_NODE,
    };
  } else if (child instanceof VElement) {
    if (typeof child.type === 'string') {
      return {
        directive: VElementDirective,
        value: child,
        nodeType: child.type,
      };
    } else {
      const directive = defineComponent(child.type);
      return {
        directive,
        value: child.props,
        nodeType: TEXT_NODE,
      };
    }
  } else if (isBindable(child)) {
    const { directive, value } = child[$toDirectiveElement]();
    return { directive, value, nodeType: COMMENT_NODE };
  } else {
    return { directive: TextPrimitive, value: child, nodeType: TEXT_NODE };
  }
}

function updateProperty(
  element: Element,
  key: string,
  newValue: unknown,
  oldValue: unknown,
  target: EventRegistry,
): void {
  switch (key.toLowerCase()) {
    case 'children':
    case 'key':
      // Skip special properties.
      return;
    case 'defaultchecked':
      if (narrowElement(element, 'INPUT')) {
        if (!Object.is(newValue, oldValue)) {
          element.defaultChecked = !!newValue;
        }
        return;
      }
      break;
    case 'defaultvalue':
      if (narrowElement(element, 'INPUT', 'OUTPUT', 'TEXTAREA')) {
        if (!Object.is(newValue, oldValue)) {
          element.defaultValue = newValue?.toString() ?? '';
        }
        return;
      }
      break;
    case 'checked':
      if (narrowElement(element, 'INPUT')) {
        const newChecked = !!newValue;
        const oldChecked = element.checked;
        if (newChecked !== oldChecked) {
          element.checked = newChecked;
        }
        return;
      }
      break;
    case 'classname':
      if (!Object.is(newValue, oldValue)) {
        element.className = newValue?.toString() ?? '';
      }
      break;
    case 'value':
      if (narrowElement(element, 'INPUT', 'OUTPUT', 'SELECT', 'TEXTAREA')) {
        const newString = newValue?.toString() ?? '';
        const oldString = element.value;
        if (newString !== oldString) {
          element.value = newString;
        }
        return;
      }
      break;
    default:
      if (key.length > 2 && key.startsWith('on')) {
        if (newValue !== oldValue) {
          if (oldValue != null) {
            target.removeEventListener(
              key.slice(2),
              oldValue as EventListenerWithOptions,
            );
          }
          if (newValue != null) {
            target.addEventListener(
              key.slice(2),
              newValue as EventListenerWithOptions,
            );
          }
        }
        return;
      }
  }

  if (!Object.is(newValue, oldValue)) {
    element.setAttribute(key, newValue?.toString() ?? '');
  }
}
