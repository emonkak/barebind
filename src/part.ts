export type Part =
  | AttributePart
  | ChildNodePart
  | ElementPart
  | EventPart
  | LivePart
  | PropertyPart
  | TextPart;

export const PartType = {
  Attribute: 0,
  ChildNode: 1,
  Element: 2,
  Event: 3,
  Live: 4,
  Property: 5,
  Text: 6,
} as const;

export type PartType = (typeof PartType)[keyof typeof PartType];

export interface AttributePart {
  type: typeof PartType.Attribute;
  node: Element;
  name: string;
}

export interface ChildNodePart {
  type: typeof PartType.ChildNode;
  node: Comment;
  childNode: ChildNode | null;
}

export interface ElementPart {
  type: typeof PartType.Element;
  node: Element;
}

export interface EventPart {
  type: typeof PartType.Event;
  node: Element;
  name: string;
}

export interface LivePart {
  type: typeof PartType.Live;
  node: Element;
  name: string;
  defaultValue: unknown;
}

export interface PropertyPart {
  type: typeof PartType.Property;
  node: Element;
  name: string;
  defaultValue: unknown;
}

export interface TextPart {
  type: typeof PartType.Text;
  node: Text;
  precedingText: string;
  followingText: string;
}

/**
 * @internal
 */
export function getStartNode(part: Part): ChildNode {
  return part.type === PartType.ChildNode
    ? (part.childNode ?? part.node)
    : part.node;
}
