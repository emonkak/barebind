/// <reference path="../../typings/moveBefore.d.ts" />

export const PART_NAMES: Record<DOMPart['type'], string> = [
  'Attribute',
  'ChildNode',
  'Element',
  'Event',
  'Live',
  'Property',
  'Text',
];

export const AttributeType = 0;
export const ChildNodeType = 1;
export const ElementType = 2;
export const EventType = 3;
export const LiveType = 4;
export const PropertyType = 5;
export const TextType = 6;

export type DOMPart =
  | DOMPart.AttributePart
  | DOMPart.ChildNodePart
  | DOMPart.ElementPart
  | DOMPart.EventPart
  | DOMPart.LivePart
  | DOMPart.PropertyPart
  | DOMPart.TextPart;

export namespace DOMPart {
  export interface AttributePart {
    type: typeof AttributeType;
    node: Element;
    name: string;
  }

  export interface ChildNodePart {
    type: typeof ChildNodeType;
    node: ChildNode;
    sentinelNode: Comment;
  }

  export interface ElementPart {
    type: typeof ElementType;
    node: Element;
  }

  export interface EventPart {
    type: typeof EventType;
    node: Element;
    name: string;
  }

  export interface LivePart {
    type: typeof LiveType;
    node: Element;
    name: string;
    defaultValue: unknown;
  }

  export interface PropertyPart {
    type: typeof PropertyType;
    node: Element;
    name: string;
    defaultValue: unknown;
  }

  export interface TextPart {
    type: typeof TextType;
    node: Text;
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

export function insertChildNodePart(
  containerPart: DOMPart.ChildNodePart,
  childPart: DOMPart.ChildNodePart,
  afterPart: DOMPart.ChildNodePart | undefined,
): void {
  const referenceNode = afterPart?.node ?? containerPart.sentinelNode;
  referenceNode.before(childPart.sentinelNode);
}

export function moveChildNodePart(
  containerPart: DOMPart.ChildNodePart,
  childPart: DOMPart.ChildNodePart,
  afterPart: DOMPart.ChildNodePart | undefined,
): void {
  const childNodes = getChildNodes(childPart);
  const referenceNode = afterPart?.node ?? containerPart.sentinelNode;
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

export function createAttributePart(
  node: Element,
  name: string,
): DOMPart.AttributePart {
  return {
    type: AttributeType,
    node,
    name,
  };
}

export function createChildNodePart(node: Comment): DOMPart.ChildNodePart {
  return {
    type: ChildNodeType,
    node,
    sentinelNode: node,
  };
}

export function createElementPart(node: Element): DOMPart.ElementPart {
  return {
    type: ElementType,
    node,
  };
}

export function createEventPart(
  node: Element,
  name: string,
): DOMPart.EventPart {
  return {
    type: EventType,
    node,
    name,
  };
}

export function createLivePart(node: Element, name: string): DOMPart.LivePart {
  return {
    type: LiveType,
    node,
    name,
    defaultValue: (node as any)[name],
  };
}

export function createPropertyPart(
  node: Element,
  name: string,
): DOMPart.PropertyPart {
  return {
    type: PropertyType,
    node,
    name,
    defaultValue: (node as any)[name],
  };
}

export function createTextPart(node: Text): DOMPart.TextPart {
  return {
    type: TextType,
    node,
  };
}
