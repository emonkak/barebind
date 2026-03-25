/// <reference path="../typings/moveBefore.d.ts" />

import {
  BOUNDARY_TYPE_HYDRATION,
  type DirectiveType,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_NAMES,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
  type Part,
  type Scope,
} from './core.js';
import { DirectiveError, HydrationError } from './error.js';

export const HTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml';
export const MATH_NAMESPACE_URI = 'http://www.w3.org/1998/Math/MathML';
export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg';

export function createAttributePart<TElement extends Element>(
  node: TElement,
  name: string,
): Part.AttributePart<TElement> {
  return {
    type: PART_TYPE_ATTRIBUTE,
    node,
    name,
  };
}

export function createChildNodePart(
  node: Comment,
  namespaceURI: string | null,
): Part.ChildNodePart {
  return {
    type: PART_TYPE_CHILD_NODE,
    node,
    sentinelNode: node,
    namespaceURI,
  };
}

export function createElementPart<TElement extends Element>(
  node: TElement,
): Part.ElementPart<TElement> {
  return {
    type: PART_TYPE_ELEMENT,
    node,
  };
}

export function createEventPart(node: Element, name: string): Part.EventPart {
  return {
    type: PART_TYPE_EVENT,
    node,
    name,
  };
}

export function createLivePart<TElement extends Element>(
  node: TElement,
  name: string,
): Part.LivePart<TElement> {
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
): Part.PropertyPart<TElement> {
  return {
    type: PART_TYPE_PROPERTY,
    node,
    name,
    defaultValue: node[name as keyof TElement],
  };
}

export function createTextPart(node: Text): Part.TextPart {
  return {
    type: PART_TYPE_TEXT,
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

export function ensurePartType<TPartType extends Part['type']>(
  expectedPartType: TPartType,
  type: DirectiveType<unknown>,
  value: unknown,
  part: Part,
): asserts part is Part & { type: TPartType } {
  if (part.type !== expectedPartType) {
    throw new DirectiveError(
      type,
      value,
      part,
      `${type.name} must be used in ${PART_TYPE_NAMES[expectedPartType]}Part.`,
    );
  }
}

export function getChildNodes(part: Part.ChildNodePart): ChildNode[] {
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
  parentPart: Part.ChildNodePart,
  childPart: Part.ChildNodePart,
  referencePart: Part.ChildNodePart | undefined,
): void {
  const referenceNode = referencePart?.node ?? parentPart.sentinelNode;
  referenceNode.before(childPart.sentinelNode);
}

export function moveChildNodePart(
  parentPart: Part.ChildNodePart,
  childPart: Part.ChildNodePart,
  referencePart: Part.ChildNodePart | undefined,
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

export function replaceSentinelNode(
  target: TreeWalker,
  sentinelNode: Comment,
): void {
  nextNode('#comment', target).replaceWith(sentinelNode);
  target.currentNode = sentinelNode;
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
