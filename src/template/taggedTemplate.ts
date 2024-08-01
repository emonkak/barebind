import { resolveBinding } from '../binding.js';
import {
  type Binding,
  type ChildNodePart,
  type Effect,
  type Part,
  PartType,
  type Template,
  type TemplateFragment,
  type UpdateContext,
  nameOf,
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
const MARKER_REGEXP = /^\?[0-9a-z]{14}\?$/;

const RANDOM_STRING_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export class TaggedTemplate<TData extends readonly any[] = readonly any[]>
  implements Template<TData>
{
  static parseHTML<TData extends readonly any[]>(
    tokens: ReadonlyArray<string>,
    values: TData,
    marker: string,
  ): TaggedTemplate<TData> {
    DEBUG: {
      ensureValidMarker(marker);
    }
    const template = document.createElement('template');
    template.innerHTML = tokens.join(marker).trim();
    const holes = parseChildren(template.content, values, marker);
    return new TaggedTemplate(template, holes);
  }

  static parseSVG<TData extends readonly any[]>(
    tokens: ReadonlyArray<string>,
    values: TData,
    marker: string,
  ): TaggedTemplate<TData> {
    DEBUG: {
      ensureValidMarker(marker);
    }
    const template = document.createElement('template');
    template.innerHTML = '<svg>' + tokens.join(marker).trim() + '</svg>';
    template.content.replaceChildren(
      ...template.content.firstChild!.childNodes,
    );
    const holes = parseChildren(template.content, values, marker);
    return new TaggedTemplate(template, holes);
  }

  private readonly _element: HTMLTemplateElement;

  private readonly _holes: Hole[];

  private constructor(element: HTMLTemplateElement, holes: Hole[]) {
    this._element = element;
    this._holes = holes;
  }

  get element(): HTMLTemplateElement {
    return this._element;
  }

  get holes(): Hole[] {
    return this._holes;
  }

  render(
    data: TData,
    context: UpdateContext<unknown>,
  ): TaggedTemplateFragment<TData> {
    const holes = this._holes;

    if (holes.length !== data.length) {
      throw new Error(
        `The number of holes was ${holes.length}, but the number of data was ${data.length}. There may be multiple holes indicating the same attribute.`,
      );
    }

    const bindings = new Array(holes.length);
    const fragment = document.importNode(this._element.content, true);

    if (holes.length > 0) {
      const walker = document.createTreeWalker(
        fragment,
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

          bindings[holeIndex] = resolveBinding(data[holeIndex], part, context);
          holeIndex++;

          if (holeIndex >= holes.length) {
            break OUTER;
          }

          currentHole = holes[holeIndex]!;
        }

        nodeIndex++;
      }
    }

    const childNodes = [...fragment.childNodes];

    // Detach child nodes from the DocumentFragment.
    fragment.replaceChildren();

    return new TaggedTemplateFragment(bindings, childNodes);
  }

  isSameTemplate(other: Template<TData>): boolean {
    return other === this;
  }
}

export class TaggedTemplateFragment<TData extends readonly any[]>
  implements TemplateFragment<TData>
{
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

  connect(context: UpdateContext<unknown>): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      const binding = this._bindings[i]!;
      binding.connect(context);
    }
  }

  bind(data: TData, context: UpdateContext<unknown>): void {
    if (data.length !== this._bindings.length) {
      throw new Error(
        `The number of new data must be ${this._bindings.length}, but got ${data.length}.`,
      );
    }

    for (let i = 0, l = this._bindings.length; i < l; i++) {
      const binding = this._bindings[i]!;

      DEBUG: {
        if (binding.part.type === PartType.ChildNode) {
          binding.part.node.data = nameOf(data[i]);
        }
      }

      binding.bind(data[i]!, context);
    }
  }

  unbind(context: UpdateContext<unknown>): void {
    const disconnectingBindings = [];

    for (let i = 0, l = this._bindings.length; i < l; i++) {
      const binding = this._bindings[i]!;
      const part = binding.part;

      if (
        (part.type === PartType.ChildNode || part.type === PartType.Node) &&
        this._childNodes.includes(part.node)
      ) {
        // This binding is mounted as a child of the root, so it must be unbound.
        binding.unbind(context);
      } else {
        // Otherwise, it does not need to be unbound.
        disconnectingBindings.push(binding);
      }
    }

    if (disconnectingBindings.length > 0) {
      context.updater.enqueueLayoutEffect(
        new DisconenctBindings(disconnectingBindings),
      );
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

export function getMarker(): string {
  return '?' + getRandomString(14) + '?';
}

export function isValidMarker(marker: string): boolean {
  return MARKER_REGEXP.test(marker);
}

class DisconenctBindings implements Effect {
  private _bindings: Binding<unknown>[];

  constructor(bindings: Binding<unknown>[]) {
    this._bindings = bindings;
  }

  commit() {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.disconnect();
    }
  }
}

function ensureValidMarker(marker: string): void {
  if (!isValidMarker(marker)) {
    throw new Error(`The marker is in an invalid format: ${marker}`);
  }
}

function getRandomString(length: number): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(length)),
    (byte) => RANDOM_STRING_CHARACTERS[byte % RANDOM_STRING_CHARACTERS.length],
  ).join('');
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

function parseChildren(
  rootNode: Node,
  values: ReadonlyArray<unknown>,
  marker: string,
): Hole[] {
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
          let hint = '';
          DEBUG: {
            hint = nameOf(values[holes.length]);
          }
          (currentNode as Comment).data = hint;
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
        const components = (currentNode as Text).data.split(marker);

        if (components.length > 1) {
          const tailCompoent = components.length - 1;

          for (let i = 0; i < tailCompoent; i++) {
            const component = components[i]!;

            if (component !== '') {
              const text = document.createTextNode(component);
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

          const tailComponent = components[tailCompoent]!;

          if (tailComponent !== '') {
            // Reuse the current node.
            (currentNode as Text).data = tailComponent;
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
