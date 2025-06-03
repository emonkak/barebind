export type Part =
  | AttributePart
  | ChildNodePart
  | ElementPart
  | EventPart
  | LivePart
  | NodePart
  | PropertyPart;

export const PartType = {
  Attribute: 0,
  ChildNode: 1,
  Element: 2,
  Event: 3,
  Live: 4,
  Node: 5,
  Property: 6,
} as const;

export type PartType = (typeof PartType)[keyof typeof PartType];

export interface AttributePart {
  type: typeof PartType.Attribute;
  node: Element;
  name: string;
}

export interface ChildNodePart {
  type: typeof PartType.ChildNode;
  node: ChildNode;
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
}

export interface NodePart {
  type: typeof PartType.Node;
  node: ChildNode;
}

export interface PropertyPart {
  type: typeof PartType.Property;
  node: Element;
  name: string;
}
