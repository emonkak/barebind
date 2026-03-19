import {
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
  type Part,
} from './core.js';

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
