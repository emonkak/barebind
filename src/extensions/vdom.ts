import { defineComponent } from '../component.js';
import { inspectPart, markUsedValue } from '../debug.js';
import {
  type Bindable,
  type Binding,
  type ComponentFunction,
  type Directive,
  type DirectiveContext,
  DirectiveObject,
  type Slot,
  type UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';

const vElementTag: unique symbol = Symbol();

export interface VElement<TProps extends Props = Props> {
  type: Directive<TProps> | ComponentFunction<TProps> | string;
  props: TProps;
  children: VChild[];
  tag: typeof vElementTag;
}

export type VChild = VNode | VNode[];

export type VNode =
  | VElement
  | boolean
  | number
  | string
  | symbol
  | symbol
  | null
  | undefined;

export type Props = Record<string, unknown>;

type Block = ElementBlock | TextBlock | DirectiveBlock | GroupBlock | NullBlock;

interface BlockNode {
  block: Block;
  alternateBlock: Block | null;
  parent: BlockNode | null;
  child: BlockNode | null;
  sibling: BlockNode | null;
}

const BlockType = {
  Directive: 0,
  Element: 1,
  Text: 2,
  Group: 3,
  Null: 4,
} as const;

interface DirectiveBlock {
  type: typeof BlockType.Directive;
  hostNode: Comment;
  slot: Slot<Bindable<Props>>;
}

interface ElementBlock {
  type: typeof BlockType.Element;
  hostNode: Element;
  pendingProps: Props;
  pendingChildren: VChild[];
  memoizedProps: Props;
}

interface TextBlock {
  type: typeof BlockType.Text;
  hostNode: Text;
  pendingContent: unknown;
}

interface GroupBlock {
  type: typeof BlockType.Group;
  hostNode: Comment;
  childNodes: BlockNode[];
}

interface NullBlock {
  type: typeof BlockType.Null;
  hostNode: Comment;
}

export function vdom(...children: VChild[]): DirectiveObject<VChild[]> {
  return new DirectiveObject(VDOMDirective, children);
}

export function h<const TProps extends Props>(
  type: Directive<TProps> | ComponentFunction<TProps> | string,
  props: TProps,
  ...children: VChild[]
): VElement<TProps> {
  return {
    type,
    props,
    children,
    tag: vElementTag,
  };
}

export const VDOMDirective: Directive<VChild[]> = {
  name: 'VDOMDirective',
  resolveBinding(
    children: VChild[],
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

class VDOMBinding implements Binding<VChild[]> {
  private _children: VChild[];

  private readonly _part: ChildNodePart;

  private readonly _rootNode: BlockNode;

  constructor(children: VChild[], part: ChildNodePart) {
    this._children = children;
    this._part = part;
    this._rootNode = createBlockNode(createNullBlock(part.node.ownerDocument));
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

  shouldBind(cihldren: VChild[]): boolean {
    return (
      (cihldren.length > 0 && this._rootNode.child === null) ||
      cihldren !== this._children
    );
  }

  bind(children: VChild[]): void {
    this._children = children;
  }

  hydrate(_hydrationTree: HydrationTree, _context: DirectiveContext): void {
    throw new Error('Hydration is not implemented.');
  }

  connect(context: UpdateContext): void {
    let currentNode: BlockNode | null = this._rootNode;

    reconcileChildren(currentNode, this._children, context);

    while ((currentNode = nextNode(currentNode)) !== null) {
      const { block } = currentNode;
      if (block.type === BlockType.Element) {
        reconcileChildren(currentNode, block.pendingChildren, context);
        block.pendingChildren = [];
      } else {
        reconcileChildren(currentNode, [], context);
      }
    }
  }

  disconnect(context: UpdateContext): void {
    let currentNode: BlockNode | null = this._rootNode;
    while ((currentNode = nextNode(currentNode))) {
      removeNode(currentNode, context);
    }
  }

  commit(): void {
    let currentNode: BlockNode | null = this._rootNode;
    let lastNode: BlockNode | null = null;

    while ((currentNode = nextNode(currentNode)) !== null) {
      lastNode = commitNode(currentNode, lastNode, this._part);
    }

    if (this._rootNode.child !== null) {
      this._part.childNode = this._rootNode.child.block.hostNode;
    } else {
      this._part.childNode = null;
    }
  }

  rollback(): void {
    let currentNode: BlockNode | null = this._rootNode;
    while ((currentNode = nextNode(currentNode)) !== null) {
      unmountBlock(currentNode.block);
    }
    this._rootNode.child = null;
    this._part.childNode = null;
  }
}

function commitNode(
  node: BlockNode,
  lastNode: BlockNode | null,
  part: ChildNodePart,
): BlockNode | null {
  const newBlock = node.alternateBlock;
  const oldBlock = node.block;

  if (lastNode !== null) {
    lastNode.sibling = node;
  }

  if (newBlock !== null) {
    if (newBlock !== oldBlock) {
      unmountBlock(oldBlock);
    }
    mountBlock(node, newBlock, part);
    return node;
  } else {
    unmountBlock(oldBlock);
    return lastNode;
  }
}

function createBlock(
  child: VChild,
  context: UpdateContext,
  document: Document,
): Block {
  switch (typeof child) {
    case 'boolean':
    case 'undefined':
      return createNullBlock(document);
    case 'object': {
      if (child === null) {
        return createNullBlock(document);
      }
      if (Array.isArray(child)) {
        return createGroupBlock(child, context, document);
      }
      if (!isVElement(child)) {
        const hostNode = document.createTextNode('');
        return createTextBlock(hostNode, child);
      }
      if (typeof child.type === 'string') {
        const hostNode = document.createElement(child.type);
        return createElementBlock(hostNode, child.props, child.children);
      }
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const directive =
        typeof child.type === 'function'
          ? defineComponent(child.type)
          : child.type;
      const object = new DirectiveObject(directive, child.props);
      const slot = context.resolveSlot(object, part);
      slot.connect(context);
      return createDirectiveBlock(slot);
    }
    default: {
      const hostNode = document.createTextNode('');
      return createTextBlock(hostNode, child);
    }
  }
}

function createBlockNode(block: Block): BlockNode {
  return {
    block,
    alternateBlock: block,
    parent: null,
    child: null,
    sibling: null,
  };
}

function createDirectiveBlock(slot: Slot<Bindable<Props>>): DirectiveBlock {
  return {
    type: BlockType.Directive,
    hostNode: slot.part.node as Comment,
    slot,
  };
}

function createElementBlock(
  hostNode: Element,
  props: { [key: string]: unknown },
  children: VChild[],
): ElementBlock {
  return {
    type: BlockType.Element,
    hostNode,
    pendingProps: props,
    pendingChildren: children,
    memoizedProps: {},
  };
}

function createGroupBlock(
  childNodes: VChild[],
  context: UpdateContext,
  document: Document,
): GroupBlock {
  return {
    type: BlockType.Group,
    hostNode: document.createComment(''),
    childNodes: childNodes.map((childNode) =>
      createBlockNode(createBlock(childNode, context, document)),
    ),
  };
}

function createNullBlock(document: Document): NullBlock {
  return {
    type: BlockType.Null,
    hostNode: document.createComment(''),
  };
}

function createTextBlock(hostNode: Text, content: unknown): TextBlock {
  return {
    type: BlockType.Text,
    hostNode,
    pendingContent: content,
  };
}

function isVElement(value: unknown): value is VElement {
  return (value as VElement)?.tag === vElementTag;
}

function mountBlock(node: BlockNode, block: Block, part: ChildNodePart): void {
  switch (block.type) {
    case BlockType.Directive: {
      const { slot } = block;
      if (slot.part.node.parentNode !== null) {
        mountHostNode(slot.part.node, node, part);
      }
      slot.commit();
      break;
    }
    case BlockType.Element: {
      const {
        hostNode,
        pendingProps: newProps,
        memoizedProps: oldProps,
      } = block;
      for (const key in oldProps) {
        if (!Object.hasOwn(newProps, key)) {
          removeProp(hostNode, key.toLowerCase(), oldProps[key]);
        }
      }
      for (const key in newProps) {
        updateProp(
          hostNode,
          key.toLowerCase(),
          newProps[key],
          Object.hasOwn(oldProps, key) ? oldProps[key] : undefined,
        );
      }
      if (hostNode.parentNode !== null) {
        mountHostNode(hostNode, node, part);
      }
      break;
    }
    case BlockType.Text: {
      const { hostNode, pendingContent } = block;
      hostNode.nodeValue = pendingContent?.toString() ?? null;
      if (hostNode.parentNode !== null) {
        mountHostNode(hostNode, node, part);
      }
      break;
    }
    case BlockType.Group: {
      const { hostNode, childNodes } = block;
      const newChildNodes: BlockNode[] = [];
      let lastNode: BlockNode | null = null;
      if (hostNode.parentNode !== null) {
        mountHostNode(hostNode, node, part);
      }
      for (let i = 0, l = childNodes.length; i < l; i++) {
        const childNode = childNodes[i]!;
        if (childNode.alternateBlock !== null) {
          newChildNodes.push(childNode);
        }
        lastNode = commitNode(childNode, lastNode, part);
      }
      block.childNodes = newChildNodes;
      break;
    }
    case BlockType.Null: {
      const { hostNode } = block;
      if (hostNode.parentNode !== null) {
        mountHostNode(hostNode, node, part);
      }
      break;
    }
  }
  node.block = block;
}

function mountHostNode(
  hostNode: Node,
  node: BlockNode,
  part: ChildNodePart,
): void {
  const oldHostNode = node.block.hostNode;

  if (oldHostNode.parentNode !== null) {
    oldHostNode.replaceWith(hostNode);
  } else if (node.parent !== null) {
    node.parent.block.hostNode.appendChild(hostNode);
  } else {
    part.node.before(hostNode);
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

function nextNode(node: BlockNode): BlockNode | null {
  let currentNode: BlockNode | null = node;
  do {
    if (currentNode.sibling !== null) {
      return currentNode.sibling;
    }
    currentNode = currentNode.parent;
  } while (currentNode !== null);
  return null;
}

function reconcileChildren(
  parentNode: BlockNode,
  children: VChild[],
  context: UpdateContext,
): void {
  const document = parentNode.block.hostNode.ownerDocument;
  let lastNode: BlockNode | null = null;
  let currentNode: BlockNode | null = parentNode.child;
  let index = 0;

  while (index < children.length && currentNode !== null) {
    const child = children[index]!;
    updateNode(currentNode, child, context);
    lastNode = currentNode;
    currentNode = currentNode.sibling;
    index++;
  }

  while (currentNode !== null) {
    removeNode(currentNode, context);
    if (lastNode !== null) {
      lastNode.sibling = null;
    }
    lastNode = currentNode;
    currentNode = currentNode.sibling;
  }

  while (index < children.length) {
    const child = children[index]!;
    const node = createBlockNode(createBlock(child, context, document));

    node.parent = parentNode;

    if (lastNode !== null) {
      lastNode.sibling = node;
    } else {
      parentNode.child = node;
    }

    lastNode = node;
    index++;
  }
}

function removeNode(node: BlockNode, context: UpdateContext): void {
  if (node.block.type === BlockType.Directive) {
    node.block.slot.disconnect(context);
  }

  node.alternateBlock = null;
}

function removeProp(element: Element, key: string, oldValue: unknown): void {
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
        element.checked = false;
        return;
      }
      break;
    case 'value':
      if (narrowElement(element, 'INPUT', 'OUTPUT', 'SELECT', 'TEXTAREA')) {
        element.value = '';
        return;
      }
      break;
  }

  if (key.length > 2 && key.startsWith('on')) {
    element.removeEventListener(
      key.slice(2),
      oldValue as EventListenerOrEventListenerObject,
    );
    return;
  }

  element.removeAttribute(key);
}

function unmountBlock(block: Block): void {
  if (block.type === BlockType.Directive) {
    block.slot.rollback();
    block.slot.part.node.remove();
  } else {
    block.hostNode.remove();
  }
}

function updateNode(
  node: BlockNode,
  child: VChild,
  context: UpdateContext,
): void {
  switch (node.block.type) {
    case BlockType.Directive:
      if (isVElement(child) && typeof child.type === 'function') {
        const object = new DirectiveObject(
          typeof child.type === 'function'
            ? defineComponent(child.type)
            : child.type,
          child.props,
        );
        node.block.slot.reconcile(object, context);
        return;
      }
      break;
    case BlockType.Element:
      if (
        isVElement(child) &&
        typeof child.type === 'string' &&
        child.type.toUpperCase() === node.block.hostNode.tagName
      ) {
        node.block.pendingProps = child.props;
        node.block.pendingChildren = child.children;
        return;
      }
      break;
    case BlockType.Text:
      if (child != null && typeof child !== 'boolean' && !isVElement(child)) {
        node.block.pendingContent = child;
        return;
      }
      break;
    case BlockType.Group:
      if (Array.isArray(child)) {
        reconcileChildren(node, child, context);
        return;
      }
      break;
    case BlockType.Null:
      if (child == null || typeof child === 'boolean') {
        return;
      }
      break;
  }

  node.alternateBlock = createBlock(
    child,
    context,
    node.block.hostNode.ownerDocument,
  );
}

function updateProp(
  element: Element,
  key: string,
  newValue: unknown,
  oldValue: unknown,
): void {
  switch (key) {
    case 'defaultchecked':
      if (narrowElement(element, 'INPUT')) {
        element.defaultChecked = !!newValue;
        return;
      }
      break;
    case 'defaultvalue':
      if (narrowElement(element, 'INPUT', 'OUTPUT', 'TEXTAREA')) {
        element.defaultValue = newValue?.toString() ?? '';
        return;
      }
      break;
    case 'checked':
      if (narrowElement(element, 'INPUT')) {
        element.checked = !!newValue;
        return;
      }
      break;
    case 'classname':
      element.className = newValue?.toString() ?? '';
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
  }

  if (key.length > 2 && key.startsWith('on')) {
    if (newValue !== oldValue) {
      if (oldValue != null) {
        element.removeEventListener(
          key.slice(2),
          oldValue as EventListenerOrEventListenerObject,
          typeof oldValue === 'object' ? oldValue : {},
        );
      }
      if (newValue != null) {
        element.addEventListener(
          key.slice(2),
          newValue as EventListenerOrEventListenerObject,
          typeof newValue === 'object' ? newValue : {},
        );
      }
    }
    return;
  }

  element.setAttribute(key, newValue?.toString() ?? '');
}
