import { shallowEqual } from '../compare.js';
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

export type VNode =
  | VNode[]
  | VElement
  | Bindable<unknown>
  | bigint
  | boolean
  | number
  | string
  | symbol
  | null
  | undefined;

export type VElementType<TProps extends Props> =
  | ComponentFunction<TProps>
  | string;

export type Props = Record<string, unknown>;

interface RenderSlot<T = unknown> {
  binding: Binding<T>;
  children: RenderSlot[];
  alternate: RenderSlot<T> | null;
  flags: number;
}

type EventRegistry = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

type EventListenerWithOptions =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions);

export const VDOMDirective: Directive<VNode[]> = {
  name: 'VDOMDirective',
  resolveBinding(
    children: VNode[],
    part: Part,
    _context: DirectiveContext,
  ): VDOMBinding {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'VDOMDirective must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(children)),
      );
    }
    return new VDOMBinding(children, part);
  },
};

export const ElementDirective: Directive<Props> = {
  name: 'ElementDirective',
  resolveBinding(
    props: Props,
    part: Part,
    _context: DirectiveContext,
  ): ElementBinding {
    if (part.type !== PartType.Element) {
      throw new Error(
        'ElementDirective must be used in an element part, but it is used here:\n' +
          inspectPart(part, markUsedValue(props)),
      );
    }
    return new ElementBinding(props, part);
  },
};

const NO_FLAGS = 0b0;
const FLAG_NEW = 0b1;
const FLAG_DIRTY = 0b10;
const FLAG_INVALIDATE = 0b100;

export function createElement<const TProps extends Props>(
  type: VElementType<{ children: VNode[] } & TProps>,
  props: TProps,
  ...children: VNode[]
): VElement<{ children: VNode[] } & TProps> {
  return new VElement(type, { children, ...props }, children);
}

export function createFragment(children: VNode[]): VFragment {
  return new VFragment(children);
}

export class VElement<TProps extends Props = Props>
  implements Bindable<VNode[]>
{
  readonly type: VElementType<TProps>;

  readonly props: TProps;

  readonly children: VNode[];

  constructor(type: VElementType<TProps>, props: TProps, children: VNode[]) {
    this.type = type;
    this.props = props;
    this.children = children;
  }

  [$toDirectiveElement](): DirectiveElement<VNode[]> {
    return {
      directive: VDOMDirective,
      value: [this],
    };
  }
}

export class VFragment implements Bindable<VNode[]> {
  readonly children: VNode[];

  constructor(children: VNode[]) {
    this.children = children;
  }

  [$toDirectiveElement](): DirectiveElement<VNode[]> {
    return {
      directive: VDOMDirective,
      value: this.children,
    };
  }
}

export class VDOMBinding implements Binding<VNode[]> {
  private _pendingChildren: VNode[];

  private readonly _slots: RenderSlot[] = [];

  private readonly _part: ChildNodePart;

  constructor(children: VNode[], part: ChildNodePart) {
    this._pendingChildren = children;
    this._part = part;
  }

  get directive(): Directive<VNode[]> {
    return VDOMDirective;
  }

  get value(): VNode[] {
    return this._pendingChildren;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  shouldBind(children: VNode[]): boolean {
    return (
      children.length !== this._slots.length ||
      children !== this._pendingChildren
    );
  }

  bind(children: VNode[]): void {
    this._pendingChildren = children;
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    if (this._slots.length > 0) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initilized.',
      );
    }

    const document = this._part.node.ownerDocument;

    for (let i = 0, l = this._pendingChildren.length; i < l; i++) {
      const child = this._pendingChildren[i]!;
      const childSlot = hydrateNode(child, hydrationTree, document, context);
      this._slots.push(childSlot);
    }
  }

  connect(context: UpdateContext): void {
    patchChildren(
      this._slots,
      this._pendingChildren,
      this._part.node.ownerDocument,
      context,
    );
  }

  disconnect(context: UpdateContext): void {
    invalidateChildren(this._slots, context);
  }

  commit(context: CommitContext): void {
    commitChildren(this._slots, this._part, context);

    if (this._slots.length > 0) {
      this._part.childNode = getStartNode(this._slots[0]!.binding.part);
    } else {
      this._part.childNode = null;
    }
  }

  rollback(context: CommitContext): void {
    rollbackChildren(this._slots, context);

    this._part.childNode = null;
  }
}

export class ElementBinding implements Binding<Props> {
  private _pendingProps: Props;

  private _memoizedProps: Props | null = null;

  private readonly _part: ElementPart;

  private readonly _listenerMap: Map<string, EventListenerWithOptions> =
    new Map();

  constructor(props: Props, part: ElementPart) {
    this._pendingProps = props;
    this._part = part;
  }

  get directive(): Directive<Props> {
    return ElementDirective;
  }

  get value(): Props {
    return this._pendingProps;
  }

  get part(): ElementPart {
    return this._part;
  }

  shouldBind(props: Props): boolean {
    return (
      this._memoizedProps === null || !shallowEqual(props, this._memoizedProps)
    );
  }

  bind(props: Props): void {
    this._pendingProps = props;
  }

  hydrate(_hydrationTree: HydrationTree, _context: UpdateContext): void {}

  connect(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}

  commit(_context: CommitContext): void {
    const element = this._part.node;
    const newProps = this._pendingProps;
    const oldProps = this._memoizedProps ?? {};

    for (const key of Object.keys(oldProps)) {
      if (!Object.hasOwn(newProps, key)) {
        removeProperty(element, key, oldProps[key]!, this);
      }
    }

    for (const key of Object.keys(newProps)) {
      updateProperty(element, key, newProps[key], oldProps[key], this);
    }

    this._memoizedProps = newProps;
  }

  rollback(_context: CommitContext): void {
    const element = this._part.node;
    const props = this._memoizedProps;

    if (props !== null) {
      for (const key of Object.keys(props)) {
        removeProperty(element, key, props[key], this);
      }
    }

    this._memoizedProps = null;
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

function commitChildren(
  childSlots: RenderSlot[],
  part: Part,
  context: CommitContext,
): void {
  let deletedCount = 0;

  for (let i = 0, l = childSlots.length; i < l; i++) {
    const slot = childSlots[i]!;

    commitSlot(slot, part, context);

    if (slot.alternate !== null) {
      childSlots[i] = slot.alternate;
    } else {
      if (slot.flags & FLAG_INVALIDATE) {
        deletedCount++;
      }
    }
  }

  childSlots.length -= deletedCount;
}

function commitSlot(
  slot: RenderSlot,
  part: Part,
  context: CommitContext,
): void {
  const { binding, children, alternate, flags } = slot;

  if (flags & FLAG_INVALIDATE) {
    binding.rollback(context);

    if (alternate !== null) {
      binding.part.node.replaceWith(alternate.binding.part.node);
      commitChildren(alternate.children, alternate.binding.part, context);
      alternate.binding.commit(context);
      alternate.flags = NO_FLAGS;
    } else {
      binding.part.node.remove();
    }
  } else {
    if (flags & FLAG_NEW) {
      if (part.type === PartType.Element) {
        part.node.appendChild(binding.part.node);
      } else {
        part.node.before(binding.part.node);
      }
    }

    commitChildren(children, binding.part, context);

    if (flags & FLAG_DIRTY) {
      binding.commit(context);
    }

    slot.flags = NO_FLAGS;
  }
}

function createRenderSlot<T>(
  binding: Binding<T>,
  children: RenderSlot[],
): RenderSlot<T> {
  return {
    binding,
    children,
    alternate: null,
    flags: FLAG_NEW | FLAG_DIRTY,
  };
}

function hydrateNode(
  node: VNode,
  hydrationTree: HydrationTree,
  document: Document,
  context: UpdateContext,
): RenderSlot {
  if (node == null || typeof node === 'boolean') {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const binding = BlackholePrimitive.resolveBinding(node, part, context);
    binding.hydrate(hydrationTree, context);
    hydrationTree
      .popNode(part.node.nodeType, part.node.nodeName)
      .replaceWith(part.node);
    return createRenderSlot(binding, []);
  } else if (Array.isArray(node)) {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const binding = VDOMDirective.resolveBinding(node, part, context);
    binding.hydrate(hydrationTree, context);
    hydrationTree
      .popNode(part.node.nodeType, part.node.nodeName)
      .replaceWith(part.node);
    return createRenderSlot(binding, []);
  } else if (node instanceof VElement) {
    if (typeof node.type === 'string') {
      const part = {
        type: PartType.Element,
        node: hydrationTree.popNode(Node.ELEMENT_NODE, node.type.toUpperCase()),
      };
      const binding = ElementDirective.resolveBinding(
        node.props,
        part,
        context,
      );
      const childSlots = node.children.map((child) =>
        renderNode(child, document, context),
      );
      binding.hydrate(hydrationTree, context);
      return createRenderSlot(binding, childSlots);
    } else {
      const props = { children: node.children, ...node.props };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const binding = defineComponent(node.type).resolveBinding(
        props,
        part,
        context,
      );
      binding.hydrate(hydrationTree, context);
      hydrationTree
        .popNode(part.node.nodeType, part.node.nodeName)
        .replaceWith(part.node);
      return createRenderSlot(binding, []);
    }
  } else if (isBindable(node)) {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const element = node[$toDirectiveElement](part, context);
    const binding = element.directive.resolveBinding(
      element.value,
      part,
      context,
    );
    binding.hydrate(hydrationTree, context);
    hydrationTree
      .popNode(part.node.nodeType, part.node.nodeName)
      .replaceWith(part.node);
    return createRenderSlot(binding, []);
  } else {
    const part = {
      type: PartType.Text,
      node: hydrationTree.splitText().popNode(Node.TEXT_NODE, '#text'),
      precedingText: '',
      followingText: '',
    };
    const binding = TextPrimitive.resolveBinding(node, part, context);
    binding.hydrate(hydrationTree, context);
    return createRenderSlot(binding, []);
  }
}

function invalidateChildren(
  childSlots: RenderSlot[],
  context: UpdateContext,
): void {
  for (let i = 0, l = childSlots.length; i < l; i++) {
    invalidateSlot(childSlots[i]!, context);
  }
}

function invalidateSlot(slot: RenderSlot, context: UpdateContext): void {
  invalidateChildren(slot.children, context);
  slot.binding.disconnect(context);
  slot.flags |= FLAG_INVALIDATE;
}

function narrowElement<
  const TType extends Uppercase<keyof HTMLElementTagNameMap>,
>(
  element: Element,
  ...expectedTypes: TType[]
): element is HTMLElementTagNameMap[Lowercase<TType>] {
  return (expectedTypes as string[]).includes(element.tagName);
}

function patchChildren(
  childSlots: RenderSlot[],
  childNodes: VNode[],
  document: Document,
  context: UpdateContext,
): void {
  const nodeTail = childNodes.length - 1;
  const slotTail = childSlots.length - 1;
  let index = 0;

  while (index <= nodeTail && index <= slotTail) {
    patchSlot(childSlots[index]!, childNodes[index]!, context);
    index++;
  }

  while (index <= slotTail) {
    invalidateSlot(childSlots[index]!, context);
    index++;
  }

  while (index <= nodeTail) {
    const newSlot = renderNode(childNodes[index]!, document, context);
    childSlots.push(newSlot);
    index++;
  }
}

function patchSlot(
  slot: RenderSlot,
  node: VNode,
  context: UpdateContext,
): void {
  const { binding } = slot;

  if (node == null || typeof node === 'boolean') {
    if (binding.directive === BlackholePrimitive) {
      updateSlot(slot, node, context);
      return;
    }
  } else if (Array.isArray(node)) {
    if (binding.directive === VDOMDirective) {
      updateSlot(slot, node, context);
      return;
    }
  } else if (node instanceof VElement) {
    if (typeof node.type === 'string') {
      if (
        binding.directive === ElementDirective &&
        binding.part.node.nodeName === node.type.toUpperCase()
      ) {
        patchChildren(
          slot.children,
          node.children,
          binding.part.node.ownerDocument,
          context,
        );
        updateSlot(slot, node.props, context);
        return;
      }
    } else {
      if (binding.directive === defineComponent(node.type)) {
        updateSlot(slot, { children: node.children, ...node.props }, context);
        return;
      }
    }
  } else if (isBindable(node)) {
    if (binding.part.type === PartType.ChildNode) {
      const { directive, value } = node[$toDirectiveElement](
        binding.part,
        context,
      );
      if (binding.directive === directive) {
        updateSlot(slot, value, context);
        return;
      }
    }
  } else {
    if (binding.directive === TextPrimitive) {
      updateSlot(slot, node, context);
      return;
    }
  }

  invalidateSlot(slot, context);

  slot.alternate = renderNode(node, binding.part.node.ownerDocument, context);
}

function removeProperty(
  element: Element,
  key: string,
  value: unknown,
  target: EventRegistry,
): void {
  switch (key.toLowerCase()) {
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
): RenderSlot {
  if (node == null || typeof node === 'boolean') {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const binding = BlackholePrimitive.resolveBinding(node, part, context);
    binding.connect(context);
    return createRenderSlot(binding, []);
  } else if (Array.isArray(node)) {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const binding = VDOMDirective.resolveBinding(node, part, context);
    binding.connect(context);
    return createRenderSlot(binding, []);
  } else if (node instanceof VElement) {
    if (typeof node.type === 'string') {
      const part = {
        type: PartType.Element,
        node: document.createElement(node.type),
      };
      const binding = ElementDirective.resolveBinding(
        node.props,
        part,
        context,
      );
      const childSlots = node.children.map((child) =>
        renderNode(child, document, context),
      );
      binding.connect(context);
      return createRenderSlot(binding, childSlots);
    } else {
      const props = { children: node.children, ...node.props };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const binding = defineComponent(node.type).resolveBinding(
        props,
        part,
        context,
      );
      binding.connect(context);
      return createRenderSlot(binding, []);
    }
  } else if (isBindable(node)) {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const element = node[$toDirectiveElement](part, context);
    const binding = element.directive.resolveBinding(
      element.value,
      part,
      context,
    );
    binding.connect(context);
    return createRenderSlot(binding, []);
  } else {
    const part = {
      type: PartType.Text,
      node: document.createTextNode(''),
      precedingText: '',
      followingText: '',
    };
    const binding = TextPrimitive.resolveBinding(node, part, context);
    binding.connect(context);
    return createRenderSlot(binding, []);
  }
}

function rollbackChildren(
  childSlots: RenderSlot[],
  context: CommitContext,
): void {
  for (let i = 0, l = childSlots.length; i < l; i++) {
    const slot = childSlots[i]!;
    const { binding, flags } = slot;

    if (flags & FLAG_INVALIDATE) {
      binding.rollback(context);
      binding.part.node.remove();
    }
  }

  childSlots.length = 0;
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

function updateSlot<T>(
  slot: RenderSlot<T>,
  value: T,
  context: UpdateContext,
): void {
  if (slot.binding.shouldBind(value)) {
    slot.binding.bind(value);
    slot.binding.connect(context);
    slot.flags |= FLAG_DIRTY;
  }

  slot.alternate = null;
  slot.flags &= ~FLAG_INVALIDATE;
}
