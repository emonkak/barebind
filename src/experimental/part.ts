import { sequentialEqual } from './compare.js';

export type Part =
  | AttributePart
  | ChildNodePart
  | ElementPart
  | EventPart
  | LivePart
  | PropertyPart
  | TextPart;

export namespace Part {
  export interface AttributePart {
    type: typeof PartType.Attribute;
    node: Element;
    name: string;
    value: unknown;
  }

  export interface ChildNodePart {
    type: typeof PartType.ChildNode;
    node: ChildNode;
    sentinelNode: Comment;
    value: unknown;
  }

  export interface ElementPart {
    type: typeof PartType.Element;
    node: Element;
    value: unknown;
  }

  export interface EventPart {
    type: typeof PartType.Event;
    node: Element;
    name: string;
    value: unknown;
  }

  export interface LivePart {
    type: typeof PartType.Live;
    node: Element;
    name: string;
    defaultValue: unknown;
    value: unknown;
  }

  export interface PropertyPart {
    type: typeof PartType.Property;
    node: Element;
    name: string;
    defaultValue: unknown;
    value: unknown;
  }

  export interface TextPart {
    type: typeof PartType.Text;
    node: Text;
    value: unknown;
  }
}

export const PartType = {
  Attribute: 0,
  ChildNode: 1,
  Element: 2,
  Event: 3,
  Live: 4,
  Property: 5,
  Text: 6,
} as const;

export function createAttributePart(
  node: Element,
  name: string,
): Part.AttributePart {
  return {
    type: PartType.Attribute,
    node,
    name,
    value: undefined,
  };
}

export function createChildNodePart(node: Comment): Part.ChildNodePart {
  return {
    type: PartType.ChildNode,
    node,
    sentinelNode: node,
    value: undefined,
  };
}

export function createElementPart(node: Element): Part.ElementPart {
  return {
    type: PartType.Element,
    node,
    value: undefined,
  };
}

export function createEventPart(node: Element, name: string): Part.EventPart {
  return {
    type: PartType.Event,
    node,
    name,
    value: undefined,
  };
}

export function createLivePart(node: Element, name: string): Part.LivePart {
  return {
    type: PartType.Live,
    node,
    name,
    defaultValue: (node as any)[name],
    value: undefined,
  };
}

export function createPropertyPart(
  node: Element,
  name: string,
): Part.PropertyPart {
  return {
    type: PartType.Property,
    node,
    name,
    defaultValue: (node as any)[name],
    value: undefined,
  };
}

export function createTextPart(node: Text): Part.TextPart {
  return {
    type: PartType.Text,
    node,
    value: undefined,
  };
}

export interface Block {
  get firstNode(): ChildNode | null;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
}

export class AttributePart {
  node: Element;
  name: string;
  value: unknown;
  mountedValue: unknown;

  constructor(node: Element, name: string) {
    this.node = node;
    this.name = name;
  }

  commit(): void {
    if (!Object.is(this.value, this.mountedValue)) {
      if (this.value == null) {
        this.node.removeAttribute(this.name);
      } else if (typeof this.value === 'boolean') {
        this.node.toggleAttribute(this.name, this.value);
      } else {
        this.node.setAttribute(this.name, this.value?.toString?.() ?? '');
      }
    }
  }

  revert(): void {
    this.node.removeAttribute(this.name);
    this.mountedValue = undefined;
  }
}

export class ChildNodePart {
  node: Comment;
  value: Block | null | undefined;
  mountedValue: Block | null | undefined;

  constructor(node: Comment, value?: Block | null | undefined) {
    this.node = node;
    this.value = value;
  }

  get firstNode(): ChildNode {
    return this.mountedValue?.firstNode ?? this.node;
  }

  commit(): void {
    if (this.value !== this.mountedValue) {
      this.mountedValue?.unmount(this);
      if (this.value != null) {
        this.value.mount(this);
      }
      this.mountedValue = this.value;
    }
  }

  moveBefore(afterNode: ChildNode): void {
    const childNodes = collectChildNodes(this);
    const { parentNode } = afterNode;

    if (parentNode !== null) {
      const insertOrMoveBefore =
        /* v8 ignore next */
        Element.prototype.moveBefore ?? Element.prototype.insertBefore;

      for (const childNode of childNodes) {
        insertOrMoveBefore.call(parentNode, childNode, afterNode);
      }
    }
  }

  revert(): void {
    if (this.mountedValue != null) {
      this.mountedValue.unmount(this);
    }
    this.mountedValue = undefined;
  }
}

export class ElementPart {
  node: Element;
  value: unknown;

  constructor(node: Element) {
    this.node = node;
  }

  commit(): void {}

  revert(): void {}
}

export class EventPart implements EventListenerObject {
  node: Element;
  name: string;
  value:
    | (EventListenerOrEventListenerObject & AddEventListenerOptions)
    | null
    | undefined;
  mountedValue:
    | (EventListenerOrEventListenerObject & AddEventListenerOptions)
    | null
    | undefined;

  constructor(node: Element, name: string) {
    this.node = node;
    this.name = name;
  }

  commit(): void {
    if (this.value !== this.mountedValue) {
      if (
        this.value == null ||
        this.mountedValue == null ||
        !compareEventListenerOptions(this.value, this.mountedValue)
      ) {
        if (this.mountedValue != null) {
          this.node.removeEventListener(this.name, this, this.mountedValue);
        }
        if (this.value != null) {
          this.node.addEventListener(this.name, this, this.value);
        }
      }
      this.mountedValue = this.value;
    }
  }

  revert(): void {
    if (this.mountedValue != null) {
      this.node.removeEventListener(this.name, this, this.mountedValue);
      this.mountedValue = undefined;
    }
  }

  handleEvent(event: Event): void {
    if (typeof this.mountedValue === 'function') {
      this.mountedValue(event);
    } else {
      this.mountedValue?.handleEvent(event);
    }
  }
}

export class LivePart {
  node: Element;
  name: string;
  value: unknown;
  defaultValue: unknown;

  constructor(node: Element, name: string) {
    this.node = node;
    this.name = name;
    this.defaultValue = (node as any)[name];
  }

  commit(): void {
    if ((this.node as any)[this.name] !== this.value) {
      (this.node as any)[this.name] = this.value;
    }
  }

  revert(): void {
    (this.node as any)[this.name] = this.defaultValue;
  }
}

export class PropertyPart {
  node: Element;
  name: string;
  value: unknown;
  defaultValue: unknown;
  mountedValue: unknown;

  constructor(node: Element, name: string) {
    const defaultValue = (node as any)[name];
    this.node = node;
    this.name = name;
    this.defaultValue = defaultValue;
    this.mountedValue = defaultValue;
  }

  commit(): void {
    if (!Object.is(this.mountedValue, this.value)) {
      (this.node as any)[this.name] = this.value;
      this.mountedValue = this.value;
    }
  }

  revert(): void {
    (this.node as any)[this.name] = this.defaultValue;
    this.mountedValue = this.defaultValue;
  }
}

export class TextPart {
  node: Text;
  value: unknown;
  mountedValue: unknown;

  constructor(node: Text) {
    this.node = node;
  }

  commit(): void {
    if (!Object.is(this.mountedValue, this.value)) {
      this.node.data = this.value?.toString?.() ?? '';
      this.mountedValue = this.value;
    }
  }

  revert(): void {
    this.node.data = '';
    this.mountedValue = undefined;
  }
}

function compareEventListenerOptions(
  newListener: EventListenerOrEventListenerObject,
  oldListener: EventListenerOrEventListenerObject,
): boolean {
  return sequentialEqual(
    getEventListenerOptions(newListener),
    getEventListenerOptions(oldListener),
  );
}

function getEventListenerOptions(
  listener: EventListenerOrEventListenerObject,
): unknown[] {
  const { capture, once, passive, signal } =
    listener as AddEventListenerOptions;
  return [capture, once, passive, signal];
}

function collectChildNodes(part: ChildNodePart): ChildNode[] {
  const firstNode = part.firstNode;
  const lastNode = part.node;
  const childNodes = [firstNode];

  for (
    let currentNode: ChildNode | null = firstNode;
    currentNode !== lastNode && currentNode.nextSibling !== null;
    currentNode = currentNode.nextSibling
  ) {
    childNodes.push(currentNode);
  }

  return childNodes;
}
