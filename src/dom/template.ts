import type { Block, TemplateMode } from '../core.js';
import { DOMTemplateError } from './error.js';
import {
  AttributePart,
  ChildNodePart,
  ClassAttributePart,
  type DOMPart,
  ElementPart,
  EventPart,
  LivePart,
  PropertyPart,
  StyleAttributePart,
  TextPart,
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
  readonly element: HTMLTemplateElement;
  readonly holes: Hole[];
  readonly mode: TemplateMode;

  static parse(
    strings: readonly string[],
    exprs: readonly unknown[],
    mode: TemplateMode,
    placeholder: string,
    document: Document,
  ) {
    DEBUG: {
      if (!PLACEHOLDER_PATTERN.test(placeholder)) {
        throw new DOMException(
          `Placeholders must match pattern /${PLACEHOLDER_PATTERN.source}/, but got "${placeholder}".`,
        );
      }
    }

    const element = document.createElement('template');
    const marker = createMarker(placeholder);
    const html = stripWhitespaces(strings.join(marker));

    if (mode === 'html') {
      element.setHTMLUnsafe(html);
    } else {
      element.setHTMLUnsafe(`<${mode}>${html}</${mode}>`);
      element.content.replaceChildren(
        ...element.content.firstChild!.childNodes,
      );
    }

    const holes = parseChildren(strings, marker, element, document);

    if (holes.length !== exprs.length) {
      throw new DOMTemplateError(
        element.content,
        `The number of holes must be ${exprs.length}, but got ${holes.length}. Multiple holes indicate the same attribute.`,
      );
    }

    return new DOMTemplate(element, holes, mode);
  }

  constructor(element: HTMLTemplateElement, holes: Hole[], mode: TemplateMode) {
    this.element = element;
    this.holes = holes;
    this.mode = mode;
  }

  render(): DOMBlock {
    const document = this.element.ownerDocument;
    const fragment = document.importNode(this.element.content, true);
    const holes = this.holes;
    const parts: DOMPart[] = new Array(holes.length);

    if (holes.length > 0) {
      const templateWalker = createTreeWalker(fragment);
      let nodeIndex = 0;

      for (let holeIndex = 0, l = holes.length; holeIndex < l; holeIndex++) {
        const hole = holes[holeIndex]!;
        for (; nodeIndex <= hole.index; nodeIndex++) {
          if (templateWalker.nextNode() === null) {
            throw new DOMTemplateError(
              templateWalker.currentNode,
              'There is no node that the hole indicates. The template may have been modified.',
            );
          }
        }
        parts[holeIndex] = resolvePart(hole, templateWalker);
      }
    }

    return new DOMBlock(fragment, parts);
  }
}

export class DOMBlock implements Block {
  private readonly _fragment: DocumentFragment;

  private readonly _staticNodes: ChildNode[];

  private readonly _parts: DOMPart[];

  constructor(fragment: DocumentFragment, parts: DOMPart[]) {
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

  mountInto(container: ParentNode, afterNode: ChildNode | null): void {
    insertBefore.call(container, this._fragment, afterNode);
  }

  moveBefore(afterNode: ChildNode): void {
    for (const node of collectChildNodes(
      this._staticNodes[0] ?? null,
      this._staticNodes.at(-1) ?? null,
    )) {
      moveBefore.call(afterNode.parentNode, node, afterNode);
    }
  }

  moveInto(container: ParentNode, afterNode: ChildNode | null): void {
    for (const node of collectChildNodes(
      this._staticNodes[0] ?? null,
      this._staticNodes.at(-1) ?? null,
    )) {
      moveBefore.call(container, node, afterNode);
    }
  }

  unmount(): void {
    for (const node of collectChildNodes(
      this._staticNodes[0] ?? null,
      this._staticNodes.at(-1) ?? null,
    )) {
      node.remove();
    }
  }
}

function collectChildNodes(
  firstNode: ChildNode | null,
  lastNode: ChildNode | null,
): ChildNode[] {
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

function parseAttribtues(
  element: Element,
  strings: readonly string[],
  marker: string,
  holes: Hole[],
  nodeIndex: number,
): void {
  for (const attribute of Array.from(element.attributes)) {
    let hole: Hole;

    if (attribute.name === marker && attribute.value === '') {
      hole = {
        type: HOLE_TYPE_ELEMENT,
        index: nodeIndex,
      };
    } else if (attribute.value === marker) {
      const caseSensitiveName = extractAttributeName(strings[holes.length]!);

      DEBUG: {
        if (caseSensitiveName?.toLowerCase() !== attribute.name) {
          throw new DOMTemplateError(
            attribute,
            `The attribute name must be "${attribute.name}", but got "${caseSensitiveName}". There are unclosed tags or duplicate attributes.`,
          );
        }
      }

      switch (caseSensitiveName[0]) {
        case '@':
          hole = {
            type: HOLE_TYPE_EVENT,
            index: nodeIndex,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '$':
          hole = {
            type: HOLE_TYPE_LIVE,
            index: nodeIndex,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '.':
          hole = {
            type: HOLE_TYPE_PROPERTY,
            index: nodeIndex,
            name: caseSensitiveName.slice(1),
          };
          break;
        default:
          hole = {
            type: HOLE_TYPE_ATTRIBUTE,
            index: nodeIndex,
            name: caseSensitiveName,
          };
          break;
      }
    } else {
      DEBUG: {
        if (attribute.name.includes(marker)) {
          throw new DOMTemplateError(
            attribute,
            'Expressions are not allowed as an attribute name.',
          );
        }

        if (attribute.value.includes(marker)) {
          throw new DOMTemplateError(
            attribute,
            'Expressions inside an attribute must make up the entire attribute value.',
          );
        }
      }
      continue;
    }

    holes.push(hole);
    element.removeAttributeNode(attribute);
  }
}

function parseChildren(
  strings: readonly string[],
  marker: string,
  template: HTMLTemplateElement,
  document: Document,
): Hole[] {
  const sourceTree = createTreeWalker(template.content);
  const holes: Hole[] = [];
  let nextNode = sourceTree.nextNode();
  let nodeIndex = 0;

  while (nextNode !== null) {
    const currentNode = nextNode;
    switch (currentNode.nodeType) {
      case Node.ELEMENT_NODE: {
        DEBUG: {
          if ((currentNode as Element).localName.includes(marker)) {
            throw new DOMTemplateError(
              currentNode as Element,
              'Expressions are not allowed as a tag name.',
            );
          }
        }
        if ((currentNode as Element).hasAttributes()) {
          parseAttribtues(
            currentNode as Element,
            strings,
            marker,
            holes,
            nodeIndex,
          );
        }
        break;
      }
      case Node.COMMENT_NODE: {
        if (
          stripTrailingSlash((currentNode as Comment).data).trim() === marker
        ) {
          if (nodeIndex === 0) {
            // Insert a marker node so the first template node keeps a stable
            // position when inserting children.
            (currentNode as Comment).before(document.createComment(''));
            nodeIndex++;
          }
          holes.push({
            type: HOLE_TYPE_CHILD_NODE,
            index: nodeIndex,
          });
          (currentNode as Comment).data = '';
        } else {
          DEBUG: {
            if ((currentNode as Comment).data.includes(marker)) {
              throw new DOMTemplateError(
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
            index: nodeIndex,
            splitIndex: i - 1,
            leadingSpan: components[i - 1]!.length,
            trailingSpan: i < tail ? 0 : components[i]!.length,
          });
        }

        if (wholeText === '' && components.length === 1) {
          nextNode = sourceTree.nextNode();
          (currentNode as Text).remove();
          continue;
        }

        (currentNode as Text).data = wholeText;
        break;
      }
    }

    nextNode = sourceTree.nextNode();
    nodeIndex++;
  }

  return holes;
}

function resolvePart(hole: Hole, treeWalker: TreeWalker): DOMPart {
  switch (hole.type) {
    case HOLE_TYPE_ATTRIBUTE:
      switch (hole.name.toLowerCase()) {
        case 'class':
          return new ClassAttributePart(
            treeWalker.currentNode as Element,
            hole.name,
          );
        case 'style':
          return new StyleAttributePart(
            treeWalker.currentNode as Element,
            hole.name,
          );
        default:
          return new AttributePart(
            treeWalker.currentNode as Element,
            hole.name,
          );
      }
    case HOLE_TYPE_EVENT:
      return new EventPart(treeWalker.currentNode as Element, hole.name);
    case HOLE_TYPE_CHILD_NODE:
      return new ChildNodePart(treeWalker.currentNode as Comment);
    case HOLE_TYPE_ELEMENT:
      return new ElementPart(treeWalker.currentNode as Element);
    case HOLE_TYPE_LIVE:
      return new LivePart(treeWalker.currentNode as Element, hole.name);
    case HOLE_TYPE_PROPERTY:
      return new PropertyPart(treeWalker.currentNode as Element, hole.name);
    case HOLE_TYPE_TEXT:
      return splitTextPart(treeWalker, hole);
  }
}

function splitTextPart(treeWalker: TreeWalker, hole: Hole.TextHole): TextPart {
  let currentNode = treeWalker.currentNode as Text;
  if (hole.splitIndex > 0) {
    currentNode = currentNode.splitText(0);
  }
  if (hole.leadingSpan > 0) {
    currentNode = currentNode.splitText(hole.leadingSpan);
  }
  const part = new TextPart(currentNode);
  if (hole.trailingSpan > 0) {
    currentNode = currentNode.splitText(0);
  }
  treeWalker.currentNode = currentNode;
  return part;
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
