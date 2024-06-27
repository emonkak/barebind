import { type Binding, resolveBinding } from '../binding.js';
import {
  type ChildNodePart,
  type Part,
  PartType,
  type Template,
  type TemplateFragment,
  type Updater,
} from '../types.js';

export type Hole =
  | AttributeHole
  | ChildNodeHole
  | ElementHole
  | EventHole
  | NodeHole
  | PropertyHole;

export interface AttributeHole {
  type: PartType.Attribute;
  index: number;
  name: string;
}

export interface ChildNodeHole {
  type: PartType.ChildNode;
  index: number;
}

export interface ElementHole {
  type: PartType.Element;
  index: number;
}

export interface EventHole {
  type: PartType.Event;
  index: number;
  name: string;
}

export interface NodeHole {
  type: PartType.Node;
  index: number;
}

export interface PropertyHole {
  type: PartType.Property;
  index: number;
  name: string;
}

// Marker Requirements:
// - A marker starts with "?" to detect when it is used as a tag name. In that
//   case, the tag is treated as a comment.
//   https://html.spec.whatwg.org/multipage/parsing.html#parse-error-unexpected-question-mark-instead-of-tag-name
// - A marker is lowercase to match attribute names.
const MARKER_REGEXP =
  /^\?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\?$/;

export class TaggedTemplate implements Template<unknown[]> {
  static parseHTML(
    tokens: ReadonlyArray<string>,
    marker: string,
  ): TaggedTemplate {
    DEBUG: {
      ensureValidMarker(marker);
    }
    const template = document.createElement('template');
    template.innerHTML = tokens.join(marker).trim();
    const holes = parseChildren(template.content, marker);
    return new TaggedTemplate(template, holes);
  }

  static parseSVG(
    tokens: ReadonlyArray<string>,
    marker: string,
  ): TaggedTemplate {
    DEBUG: {
      ensureValidMarker(marker);
    }
    const template = document.createElement('template');
    template.innerHTML = '<svg>' + tokens.join(marker).trim() + '</svg>';
    template.content.replaceChildren(
      ...template.content.firstChild!.childNodes,
    );
    const holes = parseChildren(template.content, marker);
    return new TaggedTemplate(template, holes);
  }

  private readonly _element: HTMLTemplateElement;

  private readonly _holes: Hole[];

  constructor(element: HTMLTemplateElement, holes: Hole[]) {
    this._element = element;
    this._holes = holes;
  }

  get element(): HTMLTemplateElement {
    return this._element;
  }

  get holes(): Hole[] {
    return this._holes;
  }

  hydrate(data: unknown[], updater: Updater): TaggedTemplateFragment {
    const holes = this._holes;

    if (holes.length !== data.length) {
      throw new Error(
        `The number of holes was ${holes.length}, but the number of data was ${data.length}. There may be multiple holes indicating the same attribute.`,
      );
    }

    const bindings = new Array(holes.length);
    const rootNode = document.importNode(this._element.content, true);

    if (holes.length > 0) {
      const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT |
          NodeFilter.SHOW_COMMENT,
      );

      let currentHole = holes[0]!;
      let currentNode: Node | null;
      let holeIndex = 0;
      let nodeIndex = 0;

      OUTER: while ((currentNode = walker.nextNode()) !== null) {
        while (currentHole.index === nodeIndex) {
          let part: Part;

          switch (currentHole.type) {
            case PartType.Attribute:
              part = {
                type: PartType.Attribute,
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
            case PartType.ChildNode:
              part = {
                type: PartType.ChildNode,
                node: currentNode as Comment,
              };
              break;
            case PartType.Element:
              part = {
                type: PartType.Element,
                node: currentNode as Element,
              };
              break;
            case PartType.Event:
              part = {
                type: PartType.Event,
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
            case PartType.Node:
              part = {
                type: PartType.Node,
                node: currentNode as ChildNode,
              };
              break;
            case PartType.Property:
              part = {
                type: PartType.Property,
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
          }

          const binding = resolveBinding(data[holeIndex], part, updater);
          binding.connect(updater);

          bindings[holeIndex] = binding;
          holeIndex++;

          if (holeIndex >= holes.length) {
            break OUTER;
          }

          currentHole = holes[holeIndex]!;
        }

        nodeIndex++;
      }
    }

    return new TaggedTemplateFragment(bindings, [...rootNode.childNodes]);
  }

  isSameTemplate(other: Template<unknown[]>): boolean {
    return other === this;
  }
}

export class TaggedTemplateFragment implements TemplateFragment<unknown[]> {
  private readonly _bindings: Binding<unknown>[];

  private readonly _childNodes: ChildNode[];

  constructor(bindings: Binding<unknown>[], childNodes: ChildNode[]) {
    this._bindings = bindings;
    this._childNodes = childNodes;
  }

  get childNodes(): ChildNode[] {
    return this._childNodes;
  }

  get startNode(): ChildNode | null {
    return this._childNodes[0] ?? null;
  }

  get endNode(): ChildNode | null {
    return this._childNodes.at(-1) ?? null;
  }

  get bindings(): Binding<unknown>[] {
    return this._bindings;
  }

  attach(newData: unknown[], updater: Updater): void {
    if (newData.length !== this._bindings.length) {
      throw new Error(
        `The number of new data must be ${this._bindings.length}, but got ${newData.length}.`,
      );
    }

    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.bind(newData[i]!, updater);
    }
  }

  detach(updater: Updater): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      const binding = this._bindings[i]!;
      const part = binding.part;

      if (
        (part.type === PartType.ChildNode || part.type === PartType.Node) &&
        this._childNodes.includes(part.node)
      ) {
        // This binding is mounted as a child of the root, so it must be unbound.
        binding.unbind(updater);
      } else {
        // Otherwise, it does not need to be unbound.
        binding.disconnect();
      }
    }
  }

  mount(part: ChildNodePart): void {
    const referenceNode = part.node;

    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      referenceNode.before(this._childNodes[i]!);
    }
  }

  unmount(part: ChildNodePart): void {
    const { parentNode } = part.node;

    if (parentNode !== null) {
      for (let i = 0, l = this._childNodes.length; i < l; i++) {
        parentNode.removeChild(this._childNodes[i]!);
      }
    }
  }

  disconnect(): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.disconnect();
    }
  }
}

export function getMarker(
  uuid: ReturnType<typeof crypto.randomUUID> = getUUID(),
): string {
  return '?' + uuid + '?';
}

export function isValidMarker(marker: string): boolean {
  return MARKER_REGEXP.test(marker);
}

function ensureValidMarker(marker: string): void {
  if (!isValidMarker(marker)) {
    throw new Error(`The marker is in an invalid format: ${marker}`);
  }
}

function getUUID(): ReturnType<typeof crypto.randomUUID> {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  } else {
    const s = [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const p1 = s.slice(0, 8);
    const p2 = s.slice(8, 12);
    const p3 = s.slice(12, 16);
    const p4 = s.slice(16, 20);
    const p5 = s.slice(20, 32);
    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
  }
}

function parseAttribtues(
  element: Element,
  marker: string,
  holes: Hole[],
  index: number,
): void {
  // Persist element attributes since ones may be removed.
  const attributes = [...element.attributes];

  for (let i = 0, l = attributes.length; i < l; i++) {
    const attribute = attributes[i]!;
    const name = attribute.name;
    const value = attribute.value;

    if (name === marker && value === '') {
      holes.push({
        type: PartType.Element,
        index,
      });
    } else if (value === marker) {
      if (name.length > 1 && name[0] === '@') {
        holes.push({
          type: PartType.Event,
          index,
          name: name.slice(1),
        });
      } else if (name.length > 1 && name[0] === '.') {
        holes.push({
          type: PartType.Property,
          index,
          name: name.slice(1),
        });
      } else {
        holes.push({
          type: PartType.Attribute,
          index,
          name,
        });
      }
    } else {
      DEBUG: {
        if (name.includes(marker)) {
          throw new Error(
            `Expressions are not allowed as an attribute name: ${
              (element.cloneNode() as Element).outerHTML
            }`,
          );
        }

        if (value.includes(marker)) {
          throw new Error(
            `Expressions inside an attribute must make up the entire attribute value: ${
              (element.cloneNode() as Element).outerHTML
            }`,
          );
        }
      }

      continue;
    }

    element.removeAttribute(name);
  }
}

function parseChildren(rootNode: Node, marker: string): Hole[] {
  const walker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
  const holes: Hole[] = [];

  let currentNode: ChildNode | null;
  let index = 0;

  while ((currentNode = walker.nextNode() as ChildNode | null) !== null) {
    switch (currentNode.nodeType) {
      case Node.ELEMENT_NODE: {
        DEBUG: {
          if ((currentNode as Element).tagName.includes(marker.toUpperCase())) {
            throw new Error(
              `Expressions are not allowed as a tag name: ${
                (currentNode.cloneNode() as Element).outerHTML
              }`,
            );
          }
        }
        parseAttribtues(currentNode as Element, marker, holes, index);
        break;
      }
      case Node.COMMENT_NODE: {
        if (
          trimTrailingSlash((currentNode as Comment).data).trim() === marker
        ) {
          (currentNode as Comment).data = '';
          holes.push({
            type: PartType.ChildNode,
            index,
          });
        }
        DEBUG: {
          if ((currentNode as Comment).data.includes(marker)) {
            throw new Error(
              `Expressions inside a comment must make up the entire comment value: <!--${
                (currentNode as Comment).data
              }-->`,
            );
          }
        }
        break;
      }
      case Node.TEXT_NODE: {
        const blocks = (currentNode as Text).data.split(marker);

        if (blocks.length > 1) {
          const tailIndex = blocks.length - 1;

          for (let i = 0; i < tailIndex; i++) {
            const block = blocks[i]!;

            if (block !== '') {
              const text = document.createTextNode(block);
              currentNode.before(text);
              index++;
            }

            currentNode.before(document.createTextNode(''));

            holes.push({
              type: PartType.Node,
              index,
            });
            index++;
          }

          const tailBlock = blocks[tailIndex]!;

          if (tailBlock !== '') {
            // Reuse the current node.
            (currentNode as Text).data = tailBlock;
          } else {
            walker.currentNode = currentNode.previousSibling!;
            (currentNode as Text).remove();
            index--;
          }
        }

        break;
      }
    }
    index++;
  }

  return holes;
}

function trimTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}
