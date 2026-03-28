/// <reference path="../../typings/moveBefore.d.ts" />

import type { Directive } from '../core.js';
import { nameOf } from '../debug.js';

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
    type: typeof PART_TYPE_ATTRIBUTE;
    node: Element;
    name: string;
  }

  export interface ChildNodePart {
    type: typeof PART_TYPE_CHILD_NODE;
    node: ChildNode;
    sentinelNode: Comment;
  }

  export interface ElementPart {
    type: typeof PART_TYPE_ELEMENT;
    node: Element;
  }

  export interface EventPart {
    type: typeof PART_TYPE_EVENT;
    node: Element;
    name: string;
  }

  export interface LivePart {
    type: typeof PART_TYPE_LIVE;
    node: Element;
    name: string;
    defaultValue: unknown;
  }

  export interface PropertyPart {
    type: typeof PART_TYPE_PROPERTY;
    node: Element;
    name: string;
    defaultValue: unknown;
  }

  export interface TextPart {
    type: typeof PART_TYPE_TEXT;
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
  referencePart: DOMPart.ChildNodePart | undefined,
): void {
  const referenceNode = referencePart?.node ?? containerPart.sentinelNode;
  referenceNode.before(childPart.sentinelNode);
}

export function moveChildNodePart(
  containerPart: DOMPart.ChildNodePart,
  childPart: DOMPart.ChildNodePart,
  referencePart: DOMPart.ChildNodePart | undefined,
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

export function createAttributePart(
  node: Element,
  name: string,
): DOMPart.AttributePart {
  return {
    type: PART_TYPE_ATTRIBUTE,
    node,
    name,
  };
}

export function createChildNodePart(node: Comment): DOMPart.ChildNodePart {
  return {
    type: PART_TYPE_CHILD_NODE,
    node,
    sentinelNode: node,
  };
}

export function createElementPart(node: Element): DOMPart.ElementPart {
  return {
    type: PART_TYPE_ELEMENT,
    node,
  };
}

export function createEventPart(
  node: Element,
  name: string,
): DOMPart.EventPart {
  return {
    type: PART_TYPE_EVENT,
    node,
    name,
  };
}

export function createLivePart(node: Element, name: string): DOMPart.LivePart {
  return {
    type: PART_TYPE_LIVE,
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
    type: PART_TYPE_PROPERTY,
    node,
    name,
    defaultValue: (node as any)[name],
  };
}

export function createTextPart(node: Text): DOMPart.TextPart {
  return {
    type: PART_TYPE_TEXT,
    node,
  };
}

export function ensurePartType<TPartType extends DOMPart['type']>(
  expectedPartType: TPartType,
  directive: Directive.ElementDirective,
  part: DOMPart,
): asserts part is DOMPart & { type: TPartType } {
  if (part.type !== expectedPartType) {
    throw new Error(
      `${nameOf(directive.type)} must be used in ${PART_TYPE_NAMES[expectedPartType]}Part.`,
    );
  }
}
