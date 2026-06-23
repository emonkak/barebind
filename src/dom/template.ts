import type { Block, Container, TemplateMode } from '../core.js';
import { DOMAdapterError } from './error.js';
import {
  AttributePart,
  CharacterDataPart,
  ChildNodePart,
  ClassPart,
  type DOMPart,
  ElementPart,
  EventPart,
  LivePart,
  PropertyPart,
  StylePart,
} from './part.js';

const HOLE_TYPE_ATTRIBUTE = 0;
const HOLE_TYPE_CHILD_NODE = 1;
const HOLE_TYPE_ELEMENT = 2;
const HOLE_TYPE_EVENT = 3;
const HOLE_TYPE_LIVE = 4;
const HOLE_TYPE_PROPERTY = 5;
const HOLE_TYPE_TEXT = 6;

const PLACEHOLDER_PATTERN = /^[0-9a-z_-]+$/;

const LEADING_NEWLINE_PATTERN = /^\s*\n/;
const TRAILING_NEWLINE_PATTERN = /\n\s*$/;

// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
const ATTRIBUTE_NAME_CLASS = String.raw`[^ "'>/=\p{Control}\p{Noncharacter_Code_Point}]`;
// https://infra.spec.whatwg.org/#ascii-whitespace
const WHITESPACE_CLASS = String.raw`[\t\n\f\r ]`;
const QUOTE_CLASS = `["']`;
const ATTRIBUTE_NAME_PATTERN = new RegExp(
  `${ATTRIBUTE_NAME_CLASS}+(?=${WHITESPACE_CLASS}*=${WHITESPACE_CLASS}*${QUOTE_CLASS}?$)`,
  'u',
);

const insertBefore = Element.prototype.insertBefore;
const moveBefore = Element.prototype.moveBefore ?? insertBefore;

type Hole =
  | Hole.AttributeHole
  | Hole.ChildNodeHole
  | Hole.ElementHole
  | Hole.EventHole
  | Hole.LiveHole
  | Hole.PropertyHole
  | Hole.TextHole;

namespace Hole {
  export interface AttributeHole {
    type: typeof HOLE_TYPE_ATTRIBUTE;
    index: number;
    name: string;
  }

  export interface ChildNodeHole {
    type: typeof HOLE_TYPE_CHILD_NODE;
    index: number;
  }

  export interface ElementHole {
    type: typeof HOLE_TYPE_ELEMENT;
    index: number;
  }

  export interface EventHole {
    type: typeof HOLE_TYPE_EVENT;
    index: number;
    name: string;
  }

  export interface LiveHole {
    type: typeof HOLE_TYPE_LIVE;
    index: number;
    name: string;
  }

  export interface PropertyHole {
    type: typeof HOLE_TYPE_PROPERTY;
    index: number;
    name: string;
  }

  export interface TextHole {
    type: typeof HOLE_TYPE_TEXT;
    index: number;
    splitIndex: number;
    leadingSpan: number;
    trailingSpan: number;
  }
}

export class DOMTemplate {
  private readonly _template: HTMLTemplateElement;
  private readonly _holes: Hole[];

  static parse(
    strings: readonly string[],
    values: readonly unknown[],
    mode: TemplateMode,
    placeholder: string,
    document: Document,
  ) {
    DEBUG: {
      if (!PLACEHOLDER_PATTERN.test(placeholder)) {
        throw new DOMAdapterError(
          `Placeholders must match pattern /${PLACEHOLDER_PATTERN.source}/, but got "${placeholder}".`,
        );
      }
    }

    const template = document.createElement('template');
    const marker = createMarker(placeholder);
    const html = stripWhitespaces(strings.join(marker));

    if (mode === 'html') {
      template.setHTMLUnsafe(html);
    } else {
      template.setHTMLUnsafe(`<${mode}>${html}</${mode}>`);
      template.content.replaceChildren(
        ...template.content.firstChild!.childNodes,
      );
    }

    return parseTemplate(strings, values, template, marker);
  }

  constructor(template: HTMLTemplateElement, holes: Hole[]) {
    this._template = template;
    this._holes = holes;
  }

  render(): DOMBlock {
    const document = this._template.ownerDocument;
    const fragment = document.importNode(this._template.content, true);
    const holes = this._holes;
    const parts: DOMPart[] = new Array(holes.length);

    if (holes.length > 0) {
      const treeWalker = createTreeWalker(fragment);
      let nodeIndex = 0;

      for (let holeIndex = 0, l = holes.length; holeIndex < l; holeIndex++) {
        const hole = holes[holeIndex]!;
        for (; nodeIndex <= hole.index; nodeIndex++) {
          if (treeWalker.nextNode() === null) {
            throw DOMAdapterError.withNode(
              treeWalker.currentNode,
              'There is no node that the hole indicates. The template may have been modified.',
            );
          }
        }
        parts[holeIndex] = resolvePart(hole, treeWalker);
      }
    }

    if (
      fragment.childNodes.length === 0 ||
      (holes.length > 0 &&
        holes[0]!.type === HOLE_TYPE_CHILD_NODE &&
        holes[0]!.index === 0)
    ) {
      // DOMBlock requires its `staticNodes` to be non-empty. Insert a
      // placeholder comment as a static anchor when the template has no
      // children, or when the first child is a hole (comment placeholder that
      // will be replaced) so ChildNodePart has a preceding node for block
      // insertion and replacement.
      fragment.insertBefore(document.createComment(''), fragment.firstChild);
    }

    return new DOMBlock(fragment, parts);
  }
}

export class DOMBlock implements Block {
  private readonly _fragment: DocumentFragment;

  private readonly _staticNodes: ChildNode[];

  private readonly _parts: DOMPart[];

  constructor(fragment: DocumentFragment, parts: DOMPart[]) {
    DEBUG: {
      if (fragment.childNodes.length === 0) {
        throw new DOMAdapterError(
          'The DOMBlock must have at least one child node.',
        );
      }
    }
    this._fragment = fragment;
    this._staticNodes = Array.from(fragment.childNodes);
    this._parts = parts;
  }

  get parts(): readonly DOMPart[] {
    return this._parts;
  }

  get staticNodes(): readonly ChildNode[] {
    return this._staticNodes;
  }

  mountBefore(afterNode: ChildNode): void {
    afterNode.before(this._fragment);
  }

  mountInto(container: Container, afterNode: ChildNode | null): void {
    insertBefore.call(container, this._fragment, afterNode);
  }

  moveBefore(afterNode: ChildNode): void {
    for (const node of collectChildNodes(this._staticNodes)) {
      moveBefore.call(afterNode.parentNode, node, afterNode);
    }
  }

  moveInto(container: Container, afterNode: ChildNode | null): void {
    for (const node of collectChildNodes(this._staticNodes)) {
      moveBefore.call(container, node, afterNode);
    }
  }

  unmount(): void {
    for (const node of collectChildNodes(this._staticNodes)) {
      node.remove();
    }
  }
}

function collectAttributeHoles(
  element: Element,
  strings: readonly string[],
  marker: string,
  holes: Hole[],
  index: number,
): void {
  for (const name of element.getAttributeNames()) {
    const value = element.getAttribute(name)!;
    let hole: Hole;

    if (name === marker && value === '') {
      hole = {
        type: HOLE_TYPE_ELEMENT,
        index,
      };
    } else if (value === marker) {
      const caseSensitiveName = extractAttributeName(strings[holes.length]!);

      DEBUG: {
        if (caseSensitiveName?.toLowerCase() !== name) {
          throw DOMAdapterError.withNode(
            element.getAttributeNode(name)!,
            `The attribute name must be "${name}", but got "${caseSensitiveName}". There are unclosed tags or duplicate attributes.`,
          );
        }
      }

      switch (caseSensitiveName[0]) {
        case '@':
          hole = {
            type: HOLE_TYPE_EVENT,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '$':
          hole = {
            type: HOLE_TYPE_LIVE,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '.':
          hole = {
            type: HOLE_TYPE_PROPERTY,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        default:
          hole = {
            type: HOLE_TYPE_ATTRIBUTE,
            index,
            name: caseSensitiveName,
          };
          break;
      }
    } else {
      DEBUG: {
        if (name.includes(marker)) {
          throw DOMAdapterError.withNode(
            element.getAttributeNode(name)!,
            'Expressions are not allowed as an attribute name.',
          );
        }
        if (value.includes(marker)) {
          throw DOMAdapterError.withNode(
            element.getAttributeNode(name)!,
            'Expressions inside an attribute must make up the entire attribute value.',
          );
        }
      }
      continue;
    }

    holes.push(hole);
    element.removeAttribute(name);
  }
}

function collectChildNodes(staticNodes: ChildNode[]): ChildNode[] {
  const firstNode = staticNodes[0] ?? null;
  const lastNode = staticNodes.at(-1) ?? null;
  const childNodes = [];

  for (
    let currentNode = firstNode;
    currentNode !== null;
    currentNode = currentNode.nextSibling
  ) {
    childNodes.push(currentNode);
    if (currentNode === lastNode) {
      break;
    }
  }

  return childNodes;
}

function createMarker(placeholder: string): string {
  return `?${placeholder}?`;
}

function createTreeWalker(container: DocumentFragment | Element): TreeWalker {
  return container.ownerDocument.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
}

function extractAttributeName(s: string): string | undefined {
  return s.match(ATTRIBUTE_NAME_PATTERN)?.[0];
}

function parseTemplate(
  strings: readonly string[],
  values: readonly unknown[],
  template: HTMLTemplateElement,
  marker: string,
): DOMTemplate {
  const treeWalker = createTreeWalker(template.content);
  const holes: Hole[] = [];
  let currentNode = treeWalker.nextNode();
  let index = 0;

  while (currentNode !== null) {
    switch (currentNode.nodeType) {
      case Node.ELEMENT_NODE: {
        DEBUG: {
          if ((currentNode as Element).localName.includes(marker)) {
            throw DOMAdapterError.withNode(
              currentNode as Element,
              'Expressions are not allowed as a tag name.',
            );
          }
        }
        if ((currentNode as Element).hasAttributes()) {
          collectAttributeHoles(
            currentNode as Element,
            strings,
            marker,
            holes,
            index,
          );
        }
        break;
      }
      case Node.COMMENT_NODE: {
        if (
          stripTrailingSlash((currentNode as Comment).data).trim() === marker
        ) {
          holes.push({
            type: HOLE_TYPE_CHILD_NODE,
            index,
          });
          (currentNode as Comment).data = '';
        } else {
          DEBUG: {
            if ((currentNode as Comment).data.includes(marker)) {
              throw DOMAdapterError.withNode(
                currentNode,
                'Expressions inside a comment must make up the entire comment value.',
              );
            }
          }
        }
        break;
      }
      case Node.TEXT_NODE: {
        const components = (currentNode as Text).data
          .split(marker)
          .map(stripWhitespaces);
        const wholeText = components.join('');
        const tail = components.length - 1;

        for (let i = 1; i <= tail; i++) {
          holes.push({
            type: HOLE_TYPE_TEXT,
            index,
            splitIndex: i - 1,
            leadingSpan: components[i - 1]!.length,
            trailingSpan: i < tail ? 0 : components[i]!.length,
          });
        }

        if (wholeText === '' && components.length === 1) {
          const previousNode = currentNode as Text;
          currentNode = treeWalker.nextNode();
          (previousNode as Text).remove();
          continue;
        }

        (currentNode as Text).data = wholeText;
        break;
      }
    }

    currentNode = treeWalker.nextNode();
    index++;
  }

  if (holes.length !== values.length) {
    throw DOMAdapterError.withNode(
      template.content,
      `The number of holes must be ${values.length}, but got ${holes.length}. Multiple holes indicate the same attribute.`,
    );
  }

  return new DOMTemplate(template, holes);
}

function resolvePart(hole: Hole, treeWalker: TreeWalker): DOMPart {
  let currentNode = treeWalker.currentNode;
  switch (hole.type) {
    case HOLE_TYPE_ATTRIBUTE:
      switch (hole.name.toLowerCase()) {
        case 'class':
          return new ClassPart(currentNode as Element, hole.name);
        case 'style':
          return new StylePart(currentNode as Element, hole.name);
        default:
          return new AttributePart(currentNode as Element, hole.name);
      }
    case HOLE_TYPE_EVENT:
      return new EventPart(currentNode as Element, hole.name);
    case HOLE_TYPE_CHILD_NODE:
      return new ChildNodePart(currentNode as Comment);
    case HOLE_TYPE_ELEMENT:
      return new ElementPart(currentNode as Element);
    case HOLE_TYPE_LIVE:
      return new LivePart(currentNode as Element, hole.name);
    case HOLE_TYPE_PROPERTY:
      return new PropertyPart(currentNode as Element, hole.name);
    case HOLE_TYPE_TEXT: {
      if (hole.splitIndex > 0) {
        currentNode = (currentNode as Text).splitText(0);
        treeWalker.currentNode = currentNode;
      }
      if (hole.leadingSpan > 0) {
        currentNode = (currentNode as Text).splitText(hole.leadingSpan);
        treeWalker.currentNode = currentNode;
      }
      const part = new CharacterDataPart(currentNode as Text);
      if (hole.trailingSpan > 0) {
        currentNode = (currentNode as Text).splitText(0);
        treeWalker.currentNode = currentNode;
      }
      return part;
    }
  }
}

function stripTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}

function stripWhitespaces(s: string): string {
  if (LEADING_NEWLINE_PATTERN.test(s)) {
    s = s.trimStart();
  }
  if (TRAILING_NEWLINE_PATTERN.test(s)) {
    s = s.trimEnd();
  }
  return s;
}
