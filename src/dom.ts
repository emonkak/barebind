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

interface NodeTypeMap {
  [Node.COMMENT_NODE]: Comment;
  [Node.ELEMENT_NODE]: Element;
  [Node.TEXT_NODE]: Text;
}

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

export function createTextPart(
  node: Text,
  precedingText: string,
  followingText: string,
): Part.TextPart {
  return {
    type: PART_TYPE_TEXT,
    node,
    precedingText,
    followingText,
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

export function replaceSentinelNode(
  target: TreeWalker,
  sentinelNode: Comment,
): void {
  treatNodeType(Node.COMMENT_NODE, target.nextNode(), target).replaceWith(
    sentinelNode,
  );
  target.currentNode = sentinelNode;
}

export function splitText(target: TreeWalker): Text {
  const { currentNode } = target;
  const nextNode = target.nextNode();

  if (
    currentNode instanceof Text &&
    (nextNode === null || nextNode.previousSibling === currentNode)
  ) {
    const newText = currentNode.ownerDocument.createTextNode('');
    currentNode.after(newText);
    target.currentNode = newText;
    return newText;
  } else {
    return treatNodeType(Node.TEXT_NODE, nextNode, target);
  }
}

export function treatNodeName(
  expectedName: string,
  node: Node | null,
  target: TreeWalker,
): Node {
  if (node === null || node.nodeName !== expectedName) {
    throw new HydrationError(
      target,
      `Hydration is failed because the node name is mismatched. ${expectedName} is expected here, but got ${node?.nodeName}.`,
    );
  }

  return node;
}

export function treatNodeType<TExpectedType extends keyof NodeTypeMap>(
  expectedType: TExpectedType,
  node: Node | null,
  target: TreeWalker,
): NodeTypeMap[TExpectedType] {
  if (node === null || node.nodeType !== expectedType) {
    throw new HydrationError(
      target,
      `Hydration is failed because the node type is mismatched. ${expectedType} is expected here, but got ${node?.nodeType}.`,
    );
  }

  return node as NodeTypeMap[TExpectedType];
}
