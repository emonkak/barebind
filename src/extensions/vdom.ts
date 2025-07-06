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
import type { HydrationTree } from '../hydration.js';
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

interface RenderNode<T = unknown> {
  binding: Binding<T>;
  children: RenderNode[];
  alternate: RenderNode<T> | null;
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

const FLAG_FRESH = 0b0;
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
  private _newChildren: VNode[];

  private readonly _oldChildren: RenderNode[] = [];

  private readonly _part: ChildNodePart;

  constructor(children: VNode[], part: ChildNodePart) {
    this._newChildren = children;
    this._part = part;
  }

  get directive(): Directive<VNode[]> {
    return VDOMDirective;
  }

  get value(): VNode[] {
    return this._newChildren;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  shouldBind(children: VNode[]): boolean {
    return (
      this._oldChildren.length === children.length ||
      children !== this._newChildren
    );
  }

  bind(children: VNode[]): void {
    this._newChildren = children;
  }

  hydrate(_hydrationTree: HydrationTree, _context: DirectiveContext): void {
    throw new Error('Hydration is not implemented.');
  }

  connect(context: UpdateContext): void {
    patchChildren(
      this._newChildren,
      this._oldChildren,
      this._part.node.ownerDocument,
      context,
    );
  }

  disconnect(context: UpdateContext): void {
    invalidateChildren(this._oldChildren, context);
  }

  commit(context: CommitContext): void {
    commitChildren(this._oldChildren, this._part, context);

    if (this._oldChildren.length > 0) {
      this._part.childNode = getStartNode(this._oldChildren[0]!.binding.part);
    } else {
      this._part.childNode = null;
    }
  }

  rollback(context: CommitContext): void {
    rollbackChildren(this._oldChildren, context);

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
    const newProps = this._pendingProps;
    const oldProps = this._memoizedProps ?? {};
    const element = this._part.node;

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
    const props = this._memoizedProps;
    const element = this._part.node;

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
  children: RenderNode[],
  part: Part,
  context: CommitContext,
): void {
  let deleteCount = 0;

  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]!;

    commitNode(child, part, context);

    if (child.alternate !== null) {
      children[i] = child.alternate;
    } else {
      if (child.flags & FLAG_INVALIDATE) {
        deleteCount++;
      }
    }
  }

  children.length -= deleteCount;
}

function commitNode(
  node: RenderNode,
  part: Part,
  context: CommitContext,
): void {
  const { binding, children, alternate, flags } = node;

  if (flags & FLAG_INVALIDATE) {
    binding.rollback(context);

    if (alternate !== null) {
      binding.part.node.replaceWith(alternate.binding.part.node);
      commitChildren(alternate.children, alternate.binding.part, context);
      alternate.binding.commit(context);
      alternate.flags = FLAG_FRESH;
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

    node.flags = FLAG_FRESH;
  }
}

function createRenderNode<T>(
  binding: Binding<T>,
  children: RenderNode[],
): RenderNode<T> {
  return {
    binding,
    children,
    alternate: null,
    flags: FLAG_NEW | FLAG_DIRTY,
  };
}

function invalidateChildren(
  children: RenderNode[],
  context: UpdateContext,
): void {
  for (let i = 0, l = children.length; i < l; i++) {
    invalidateNode(children[i]!, context);
  }
}

function invalidateNode(node: RenderNode, context: UpdateContext): void {
  invalidateChildren(node.children, context);

  node.binding.disconnect(context);
  node.flags |= FLAG_INVALIDATE;
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
  newChildren: VNode[],
  oldChildren: RenderNode[],
  document: Document,
  context: UpdateContext,
): void {
  const newTail = newChildren.length - 1;
  const oldTail = oldChildren.length - 1;
  let index = 0;

  while (index <= newTail && index <= oldTail) {
    patchNode(newChildren[index]!, oldChildren[index]!, context);
    index++;
  }

  while (index <= oldTail) {
    invalidateNode(oldChildren[index]!, context);
    index++;
  }

  while (index <= newTail) {
    const node = renderNode(newChildren[index]!, document, context);
    node.binding.connect(context);
    oldChildren.push(node);
    index++;
  }
}

function patchNode(
  newNode: VNode,
  oldNode: RenderNode,
  context: UpdateContext,
): void {
  const { binding } = oldNode;

  if (newNode == null || typeof newNode === 'boolean') {
    if (binding.directive === BlackholePrimitive) {
      updateNode(oldNode, newNode, context);
      return;
    }
  } else if (Array.isArray(newNode)) {
    if (binding.directive === VDOMDirective) {
      updateNode(oldNode, newNode, context);
      return;
    }
  } else if (newNode instanceof VElement) {
    if (typeof newNode.type === 'string') {
      if (binding.part.node.nodeName === newNode.type.toUpperCase()) {
        patchChildren(
          newNode.children,
          oldNode.children,
          binding.part.node.ownerDocument,
          context,
        );
        updateNode(oldNode, newNode.props, context);
        return;
      }
    } else {
      if (binding.directive === defineComponent(newNode.type)) {
        updateNode(
          oldNode,
          { children: newNode.children, ...newNode.props },
          context,
        );
        return;
      }
    }
  } else if (isBindable(newNode)) {
    if (binding.part.type === PartType.ChildNode) {
      const { directive, value } = newNode[$toDirectiveElement](
        binding.part,
        context,
      );
      if (binding.directive === directive) {
        updateNode(oldNode, value, context);
        return;
      }
    }
  } else {
    if (binding.directive === TextPrimitive) {
      updateNode(oldNode, newNode, context);
      return;
    }
  }

  invalidateNode(oldNode, context);

  oldNode.alternate = renderNode(
    newNode,
    binding.part.node.ownerDocument,
    context,
  );
}

function removeProperty(
  element: Element,
  key: string,
  value: unknown,
  target: EventRegistry,
): void {
  switch (key) {
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
): RenderNode {
  if (node == null || typeof node === 'boolean') {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const binding = BlackholePrimitive.resolveBinding(node, part, context);
    binding.connect(context);
    return createRenderNode(binding, []);
  } else if (Array.isArray(node)) {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    };
    const binding = VDOMDirective.resolveBinding(node, part, context);
    binding.connect(context);
    return createRenderNode(binding, []);
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
      const children = node.children.map((child) =>
        renderNode(child, document, context),
      );
      binding.connect(context);
      return createRenderNode(binding, children);
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
      return createRenderNode(binding, []);
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
    return createRenderNode(binding, []);
  } else {
    const part = {
      type: PartType.Text,
      node: document.createTextNode(''),
      precedingText: '',
      followingText: '',
    };
    const binding = TextPrimitive.resolveBinding(node, part, context);
    binding.connect(context);
    return createRenderNode(binding, []);
  }
}

function rollbackChildren(
  children: RenderNode[],
  context: CommitContext,
): void {
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]!;
    const { binding, flags } = child;

    if (flags & FLAG_INVALIDATE) {
      binding.rollback(context);
      binding.part.node.remove();
    }
  }

  children.length = 0;
}

function updateNode<T>(
  node: RenderNode<T>,
  value: T,
  context: UpdateContext,
): void {
  if (node.binding.shouldBind(value)) {
    node.binding.bind(value);
    node.binding.connect(context);
    node.flags |= FLAG_DIRTY;
  }

  node.alternate = null;
  node.flags &= ~FLAG_INVALIDATE;
}

function updateProperty(
  element: Element,
  key: string,
  newValue: unknown,
  oldValue: unknown,
  target: EventRegistry,
): void {
  switch (key) {
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
