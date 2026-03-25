/// <reference path="../typings/moveBefore.d.ts" />

import {
  BOUNDARY_TYPE_HYDRATION,
  type DirectiveType,
  type Scope,
} from './core.js';
import { DirectiveError, HydrationError } from './error.js';

export const DOM_PART_TYPE_NAMES = [
  'Attribute',
  'ChildNode',
  'Element',
  'Event',
  'Live',
  'Property',
  'Text',
] as const;

export const DOM_PART_TYPE_ATTRIBUTE = 0;
export const DOM_PART_TYPE_CHILD_NODE = 1;
export const DOM_PART_TYPE_ELEMENT = 2;
export const DOM_PART_TYPE_EVENT = 3;
export const DOM_PART_TYPE_LIVE = 4;
export const DOM_PART_TYPE_PROPERTY = 5;
export const DOM_PART_TYPE_TEXT = 6;

export const HTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml';
export const MATH_NAMESPACE_URI = 'http://www.w3.org/1998/Math/MathML';
export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg';

export type DOMHole =
  | DOMHole.AttributeHole
  | DOMHole.ChildNodeHole
  | DOMHole.ElementHole
  | DOMHole.EventHole
  | DOMHole.LiveHole
  | DOMHole.PropertyHole
  | DOMHole.TextHole;

export namespace DOMHole {
  export interface AttributeHole {
    type: typeof DOM_PART_TYPE_ATTRIBUTE;
    index: number;
    name: string;
  }

  export interface ChildNodeHole {
    type: typeof DOM_PART_TYPE_CHILD_NODE;
    index: number;
  }

  export interface ElementHole {
    type: typeof DOM_PART_TYPE_ELEMENT;
    index: number;
  }

  export interface EventHole {
    type: typeof DOM_PART_TYPE_EVENT;
    index: number;
    name: string;
  }

  export interface LiveHole {
    type: typeof DOM_PART_TYPE_LIVE;
    index: number;
    name: string;
  }

  export interface PropertyHole {
    type: typeof DOM_PART_TYPE_PROPERTY;
    index: number;
    name: string;
  }

  export interface TextHole {
    type: typeof DOM_PART_TYPE_TEXT;
    index: number;
    leadingSpan: number;
    trailingSpan: number;
  }
}

export type DOMPart =
  | DOMPart.AttributePart
  | DOMPart.ChildNodePart
  | DOMPart.ElementPart
  | DOMPart.EventPart
  | DOMPart.LivePart
  | DOMPart.PropertyPart
  | DOMPart.TextPart;

export namespace DOMPart {
  export interface AttributePart<TElement extends Element = Element> {
    type: typeof DOM_PART_TYPE_ATTRIBUTE;
    node: TElement;
    name: string;
  }

  export interface ChildNodePart {
    type: typeof DOM_PART_TYPE_CHILD_NODE;
    node: ChildNode;
    sentinelNode: Comment;
    namespaceURI: string | null;
  }

  export interface ElementPart<TElement extends Element = Element> {
    type: typeof DOM_PART_TYPE_ELEMENT;
    node: TElement;
  }

  export interface EventPart<TElement extends Element = Element> {
    type: typeof DOM_PART_TYPE_EVENT;
    node: TElement;
    name: string;
  }

  export interface LivePart<TElement extends Element = Element> {
    type: typeof DOM_PART_TYPE_LIVE;
    node: TElement;
    name: string;
    defaultValue: unknown;
  }

  export interface PropertyPart<TElement extends Element = Element> {
    type: typeof DOM_PART_TYPE_PROPERTY;
    node: TElement;
    name: string;
    defaultValue: unknown;
  }

  export interface TextPart {
    type: typeof DOM_PART_TYPE_TEXT;
    node: Text;
  }
}

export function createAttributePart<TElement extends Element>(
  node: TElement,
  name: string,
): DOMPart.AttributePart<TElement> {
  return {
    type: DOM_PART_TYPE_ATTRIBUTE,
    node,
    name,
  };
}

export function createChildNodePart(
  node: Comment,
  namespaceURI: string | null,
): DOMPart.ChildNodePart {
  return {
    type: DOM_PART_TYPE_CHILD_NODE,
    node,
    sentinelNode: node,
    namespaceURI,
  };
}

export function createElementPart<TElement extends Element>(
  node: TElement,
): DOMPart.ElementPart<TElement> {
  return {
    type: DOM_PART_TYPE_ELEMENT,
    node,
  };
}

export function createEventPart(
  node: Element,
  name: string,
): DOMPart.EventPart {
  return {
    type: DOM_PART_TYPE_EVENT,
    node,
    name,
  };
}

export function createLivePart<TElement extends Element>(
  node: TElement,
  name: string,
): DOMPart.LivePart<TElement> {
  return {
    type: DOM_PART_TYPE_LIVE,
    node,
    name,
    defaultValue: node[name as keyof TElement],
  };
}

export function createPropertyPart<TElement extends Element>(
  node: TElement,
  name: string,
): DOMPart.PropertyPart<TElement> {
  return {
    type: DOM_PART_TYPE_PROPERTY,
    node,
    name,
    defaultValue: node[name as keyof TElement],
  };
}

export function createTextPart(node: Text): DOMPart.TextPart {
  return {
    type: DOM_PART_TYPE_TEXT,
    node,
  };
}

export function createTreeWalker(
  container: DocumentFragment | Element,
): TreeWalker {
  return container.ownerDocument.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
}

export function ensurePartType<TPartType extends DOMPart['type']>(
  expectedPartType: TPartType,
  type: DirectiveType<unknown>,
  value: unknown,
  part: DOMPart,
): asserts part is DOMPart & { type: TPartType } {
  if (part.type !== expectedPartType) {
    throw new DirectiveError(
      type,
      value,
      part,
      `${type.name} must be used in ${DOM_PART_TYPE_NAMES[expectedPartType]}Part.`,
    );
  }
}

export function getChildNodes(part: DOMPart.ChildNodePart): ChildNode[] {
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

export function getHydrationTarget(scope: Scope): TreeWalker | null {
  for (
    let boundary = scope.boundary;
    boundary !== null;
    boundary = boundary.next
  ) {
    if (boundary.type === BOUNDARY_TYPE_HYDRATION) {
      return boundary.target;
    }
  }
  return null;
}

export function getNamespaceURIByTagName(tagName: string): string | null {
  switch (tagName.toLowerCase()) {
    case 'html':
      return HTML_NAMESPACE_URI;
    case 'math':
      return MATH_NAMESPACE_URI;
    case 'svg':
      return SVG_NAMESPACE_URI;
    default:
      return null;
  }
}

export function insertChildNodePart(
  parentPart: DOMPart.ChildNodePart,
  childPart: DOMPart.ChildNodePart,
  referencePart: DOMPart.ChildNodePart | undefined,
): void {
  const referenceNode = referencePart?.node ?? parentPart.sentinelNode;
  referenceNode.before(childPart.sentinelNode);
}

export function moveChildNodePart(
  parentPart: DOMPart.ChildNodePart,
  childPart: DOMPart.ChildNodePart,
  referencePart: DOMPart.ChildNodePart | undefined,
): void {
  const childNodes = getChildNodes(childPart);
  const referenceNode = referencePart?.node ?? parentPart.sentinelNode;
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

export function nextNode(
  expectedName: '#comment',
  treeWalker: TreeWalker,
): Comment;
export function nextNode(expectedName: '#text', treeWalker: TreeWalker): Text;
export function nextNode(expectedName: string, treeWalker: TreeWalker): Node;
export function nextNode(expectedName: string, treeWalker: TreeWalker): Node {
  const node = treeWalker.nextNode();

  if (node === null || node.nodeName !== expectedName) {
    throw new HydrationError(
      treeWalker.currentNode,
      `Hydration is failed because the node name is mismatched. ${expectedName} is expected here, but got ${node?.nodeName}.`,
    );
  }

  return node;
}

export function replaceSentinelNode(
  target: TreeWalker,
  sentinelNode: Comment,
): void {
  nextNode('#comment', target).replaceWith(sentinelNode);
  target.currentNode = sentinelNode;
}
