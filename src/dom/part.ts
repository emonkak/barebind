import type { TemplateMode } from '../core.js';

export const PART_TYPE_NAMES = [
  'Attribute',
  'ChildNode',
  'Element',
  'Event',
  'Live',
  'Property',
  'Text',
] as const;

export const PART_TYPE_ATTRIBUTE = 0;
export const PART_TYPE_CHILD_NODE = 1;
export const PART_TYPE_ELEMENT = 2;
export const PART_TYPE_EVENT = 3;
export const PART_TYPE_LIVE = 4;
export const PART_TYPE_PROPERTY = 5;
export const PART_TYPE_TEXT = 6;

export const NAMESPACE_URI_MAP: Record<TemplateMode, string | null> = {
  html: 'http://www.w3.org/1999/xhtml',
  math: 'http://www.w3.org/1998/Math/MathML',
  svg: 'http://www.w3.org/2000/svg',
  textarea: null,
};

export type DOMPart =
  | DOMPart.Attribute
  | DOMPart.ChildNode
  | DOMPart.Element
  | DOMPart.Event
  | DOMPart.Live
  | DOMPart.Property
  | DOMPart.Text;

export namespace DOMPart {
  export interface Attribute<
    TElement extends globalThis.Element = globalThis.Element,
  > {
    type: typeof PART_TYPE_ATTRIBUTE;
    node: TElement;
    name: string;
  }

  export interface ChildNode {
    type: typeof PART_TYPE_CHILD_NODE;
    node: globalThis.ChildNode;
    sentinelNode: Comment;
    namespaceURI: string | null;
  }

  export interface Element<
    TElement extends globalThis.Element = globalThis.Element,
  > {
    type: typeof PART_TYPE_ELEMENT;
    node: TElement;
  }

  export interface Event<
    TElement extends globalThis.Element = globalThis.Element,
  > {
    type: typeof PART_TYPE_EVENT;
    node: TElement;
    name: string;
  }

  export interface Live<
    TElement extends globalThis.Element = globalThis.Element,
  > {
    type: typeof PART_TYPE_LIVE;
    node: TElement;
    name: string;
    defaultValue: unknown;
  }

  export interface Property<
    TElement extends globalThis.Element = globalThis.Element,
  > {
    type: typeof PART_TYPE_PROPERTY;
    node: TElement;
    name: string;
    defaultValue: unknown;
  }

  export interface Text {
    type: typeof PART_TYPE_TEXT;
    node: globalThis.Text;
  }
}

export function getChildNodes(part: DOMPart.ChildNode): ChildNode[] {
  const startNode = part.node;
  const endNode = part.sentinelNode;
  const childNodes = [startNode];
  let currentNode: ChildNode | null = startNode;

  while (currentNode !== endNode && currentNode.nextSibling !== null) {
    currentNode = currentNode.nextSibling;
    childNodes.push(currentNode);
  }

  return childNodes;
}

export function insertChildNodePart(
  containerPart: DOMPart.ChildNode,
  childPart: DOMPart.ChildNode,
  referencePart: DOMPart.ChildNode | undefined,
): void {
  const referenceNode = referencePart?.node ?? containerPart.sentinelNode;
  referenceNode.before(childPart.sentinelNode);
}

export function moveChildNodePart(
  containerPart: DOMPart.ChildNode,
  childPart: DOMPart.ChildNode,
  referencePart: DOMPart.ChildNode | undefined,
): void {
  const childNodes = getChildNodes(childPart);
  const referenceNode = referencePart?.node ?? containerPart.sentinelNode;
  const { parentNode } = referenceNode;

  if (parentNode !== null) {
    const insertOrMoveBefore =
      /* v8 ignore next */
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;

    for (const sibling of childNodes) {
      insertOrMoveBefore.call(parentNode, sibling, referenceNode);
    }
  }
}

export function createAttributePart<TElement extends Element>(
  node: TElement,
  name: string,
): DOMPart.Attribute<TElement> {
  return {
    type: PART_TYPE_ATTRIBUTE,
    node,
    name,
  };
}

export function createChildNodePart(
  node: Comment,
  namespaceURI: string | null,
): DOMPart.ChildNode {
  return {
    type: PART_TYPE_CHILD_NODE,
    node,
    sentinelNode: node,
    namespaceURI,
  };
}

export function createElementPart<TElement extends Element>(
  node: TElement,
): DOMPart.Element<TElement> {
  return {
    type: PART_TYPE_ELEMENT,
    node,
  };
}

export function createEventPart(node: Element, name: string): DOMPart.Event {
  return {
    type: PART_TYPE_EVENT,
    node,
    name,
  };
}

export function createLivePart<TElement extends Element>(
  node: TElement,
  name: string,
): DOMPart.Live<TElement> {
  return {
    type: PART_TYPE_LIVE,
    node,
    name,
    defaultValue: node[name as keyof TElement],
  };
}

export function createPropertyPart<TElement extends Element>(
  node: TElement,
  name: string,
): DOMPart.Property<TElement> {
  return {
    type: PART_TYPE_PROPERTY,
    node,
    name,
    defaultValue: node[name as keyof TElement],
  };
}

export function createTextPart(node: Text): DOMPart.Text {
  return {
    type: PART_TYPE_TEXT,
    node,
  };
}
