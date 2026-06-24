import type { TemplateMode } from '../core.js';
import { DOMBlock } from './block.js';
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

interface Cursor {
  node: Node;
  path: number[];
}

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
    path: number[];
    name: string;
  }

  export interface ChildNodeHole {
    type: typeof HOLE_TYPE_CHILD_NODE;
    path: number[];
  }

  export interface ElementHole {
    type: typeof HOLE_TYPE_ELEMENT;
    path: number[];
  }

  export interface EventHole {
    type: typeof HOLE_TYPE_EVENT;
    path: number[];
    name: string;
  }

  export interface LiveHole {
    type: typeof HOLE_TYPE_LIVE;
    path: number[];
    name: string;
  }

  export interface PropertyHole {
    type: typeof HOLE_TYPE_PROPERTY;
    path: number[];
    name: string;
  }

  export interface TextHole {
    type: typeof HOLE_TYPE_TEXT;
    path: number[];
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
      const cursor = createCursor(fragment);

      for (let i = 0, l = holes.length; i < l; i++) {
        const hole = holes[i]!;
        if (!moveCursor(cursor, hole.path, fragment)) {
          throw DOMAdapterError.withNode(
            cursor.currentNode,
            'There is no node that the hole indicates. The template may have been modified.',
          );
        }
        parts[i] = resolvePart(hole, cursor.currentNode);
      }
    }

    if (
      fragment.childNodes.length === 0 ||
      (holes.length > 0 && isFirstRootNodeHole(holes[0]!))
    ) {
      // DOMBlock requires its `staticNodes` to be non-empty. Insert a
      // placeholder comment as a static anchor when the template has no
      // children, or when the first child is a hole (comment placeholder that
      // will be replaced) so ChildNodePart has a preceding node for block
      // insertion and replacement.
      fragment.prepend(document.createComment(''));
    }

    return new DOMBlock(fragment, parts);
  }
}

function advanceCursor(cursor: Cursor): Node | null {
  let currentNode: Node | null = cursor.node;
  let nextNode: Node | null;
  if ((nextNode = currentNode.firstChild) !== null) {
    cursor.path.push(0);
  } else {
    while ((nextNode = currentNode.nextSibling) === null) {
      if ((currentNode = currentNode.parentNode) === null) {
        return null;
      }
      cursor.path.pop();
    }
    incrementCursor(cursor);
  }
  cursor.node = nextNode;
  return nextNode;
}

function collectAttributeHoles(
  element: Element,
  strings: readonly string[],
  marker: string,
  holes: Hole[],
  path: number[],
): void {
  for (const name of element.getAttributeNames()) {
    const value = element.getAttribute(name)!;
    let hole: Hole;

    if (name === marker && value === '') {
      hole = {
        type: HOLE_TYPE_ELEMENT,
        path: path.slice(),
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
            path: path.slice(),
            name: caseSensitiveName.slice(1),
          };
          break;
        case '$':
          hole = {
            type: HOLE_TYPE_LIVE,
            path: path.slice(),
            name: caseSensitiveName.slice(1),
          };
          break;
        case '.':
          hole = {
            type: HOLE_TYPE_PROPERTY,
            path: path.slice(),
            name: caseSensitiveName.slice(1),
          };
          break;
        default:
          hole = {
            type: HOLE_TYPE_ATTRIBUTE,
            path: path.slice(),
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

function createCursor(node: Node): Cursor {
  return {
    node,
    path: [],
  };
}

function createMarker(placeholder: string): string {
  return `?${placeholder}?`;
}

function decrementCursor(cursor: Cursor): void {
  cursor.path[cursor.path.length - 1]!--;
}

function extractAttributeName(s: string): string | undefined {
  return s.match(ATTRIBUTE_NAME_PATTERN)?.[0];
}

function isFirstRootNodeHole(hole: Hole): boolean {
  return (
    hole.type === HOLE_TYPE_CHILD_NODE &&
    hole.path.length === 1 &&
    hole.path[0] === 0
  );
}

function incrementCursor(cursor: Cursor): void {
  cursor.path[cursor.path.length - 1]!++;
}

function moveCursor(cursor: Cursor, newPath: number[], root: Node): boolean {
  let newNode: Node | undefined = root;

  for (const index of newPath) {
    newNode = newNode.childNodes[index];
    if (newNode === undefined) {
      return false;
    }
  }

  cursor.currentNode = newNode;
  cursor.path = newPath;

  return true;
}

function parseTemplate(
  strings: readonly string[],
  values: readonly unknown[],
  template: HTMLTemplateElement,
  marker: string,
): DOMTemplate {
  const cursor = createCursor(template.content);
  const holes: Hole[] = [];
  let currentNode = advanceCursor(cursor);

  while (currentNode !== null) {
    switch (currentNode.nodeType) {
      case Node.ELEMENT_NODE:
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
            cursor.path,
          );
        }
        break;
      case Node.COMMENT_NODE:
        if (
          stripTrailingSlash((currentNode as Comment).data).trim() === marker
        ) {
          holes.push({
            type: HOLE_TYPE_CHILD_NODE,
            path: cursor.path.slice(),
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
      case Node.TEXT_NODE: {
        const components = (currentNode as Text).data
          .split(marker)
          .map(stripWhitespaces);
        const suffixIndex = components.length - 1;
        const suffixComponent = components[suffixIndex]!;

        for (let i = 0; i < suffixIndex; i++) {
          const prefixComponent = components[i]!;
          if (prefixComponent !== '') {
            const prefixNode = currentNode;
            currentNode = (currentNode as Text).splitText(0);
            (prefixNode as Text).data = prefixComponent;
            advanceCursor(cursor);
          }
          holes.push({
            type: HOLE_TYPE_TEXT,
            path: cursor.path.slice(),
          });
          currentNode = (currentNode as Text).splitText(0);
          advanceCursor(cursor);
        }

        if (suffixComponent === '') {
          decrementCursor(cursor);
          const lookaheadNode = advanceCursor(cursor);
          (currentNode as Text).remove();
          currentNode = lookaheadNode;
          continue;
        }

        (currentNode as Text).data = suffixComponent;
        break;
      }
    }
    currentNode = advanceCursor(cursor);
  }

  if (holes.length !== values.length) {
    throw DOMAdapterError.withNode(
      template.content,
      `The number of holes must be ${values.length}, but got ${holes.length}. Multiple holes indicate the same attribute.`,
    );
  }

  return new DOMTemplate(template, holes);
}

function resolvePart(hole: Hole, node: Node): DOMPart {
  switch (hole.type) {
    case HOLE_TYPE_ATTRIBUTE:
      switch (hole.name.toLowerCase()) {
        case 'class':
          return new ClassPart(node as Element, hole.name);
        case 'style':
          return new StylePart(node as Element, hole.name);
        default:
          return new AttributePart(node as Element, hole.name);
      }
    case HOLE_TYPE_EVENT:
      return new EventPart(node as Element, hole.name);
    case HOLE_TYPE_CHILD_NODE:
      return new ChildNodePart(node as Comment);
    case HOLE_TYPE_ELEMENT:
      return new ElementPart(node as Element);
    case HOLE_TYPE_LIVE:
      return new LivePart(node as Element, hole.name);
    case HOLE_TYPE_PROPERTY:
      return new PropertyPart(node as Element, hole.name);
    case HOLE_TYPE_TEXT:
      return new CharacterDataPart(node as Text);
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
