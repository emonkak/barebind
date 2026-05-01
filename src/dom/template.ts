import type { TemplateMode } from '../core.js';
import { DOMNodeError } from './error.js';

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

export const AttributeType = 0;
export const ChildNodeType = 1;
export const ElementType = 2;
export const EventType = 3;
export const LiveType = 4;
export const PropertyType = 5;
export const TextType = 6;

export type Hole =
  | Hole.AttributeHole
  | Hole.ChildNodeHole
  | Hole.ElementHole
  | Hole.EventHole
  | Hole.LiveHole
  | Hole.PropertyHole
  | Hole.TextHole;

export namespace Hole {
  export interface AttributeHole {
    type: typeof AttributeType;
    index: number;
    name: string;
  }

  export interface ChildNodeHole {
    type: typeof ChildNodeType;
    index: number;
  }

  export interface ElementHole {
    type: typeof ElementType;
    index: number;
  }

  export interface EventHole {
    type: typeof EventType;
    index: number;
    name: string;
  }

  export interface LiveHole {
    type: typeof LiveType;
    index: number;
    name: string;
  }

  export interface PropertyHole {
    type: typeof PropertyType;
    index: number;
    name: string;
  }

  export interface TextHole {
    type: typeof TextType;
    index: number;
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
        throw new Error(
          `Placeholders must match pattern ${PLACEHOLDER_PATTERN.source}, but got "${placeholder}".`,
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
      throw DOMNodeError.fromNode(
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
}

export function createTreeWalker(
  container: DocumentFragment | Element,
): TreeWalker {
  return container.ownerDocument.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
}

function createMarker(placeholder: string): string {
  return `?${placeholder}?`;
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
        type: ElementType,
        index: nodeIndex,
      };
    } else if (attribute.value === marker) {
      const caseSensitiveName = extractAttributeName(strings[holes.length]!);

      DEBUG: {
        if (caseSensitiveName?.toLowerCase() !== attribute.name) {
          throw DOMNodeError.fromAttribute(
            element,
            attribute.name,
            `The attribute name must be "${attribute.name}", but got "${caseSensitiveName}". There are unclosed tags or duplicate attributes.`,
          );
        }
      }

      switch (caseSensitiveName[0]) {
        case '@':
          hole = {
            type: EventType,
            index: nodeIndex,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '$':
          hole = {
            type: LiveType,
            index: nodeIndex,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '.':
          hole = {
            type: PropertyType,
            index: nodeIndex,
            name: caseSensitiveName.slice(1),
          };
          break;
        default:
          hole = {
            type: AttributeType,
            index: nodeIndex,
            name: caseSensitiveName,
          };
          break;
      }
    } else {
      DEBUG: {
        if (attribute.name.includes(marker)) {
          throw DOMNodeError.fromAttribute(
            element,
            attribute.name,
            'Expressions are not allowed as an attribute name.',
          );
        }

        if (attribute.value.includes(marker)) {
          throw DOMNodeError.fromAttribute(
            element,
            attribute.name,
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
            throw DOMNodeError.fromNode(
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
            type: ChildNodeType,
            index: nodeIndex,
          });
          (currentNode as Comment).data = '';
        } else {
          DEBUG: {
            if ((currentNode as Comment).data.includes(marker)) {
              throw DOMNodeError.fromNode(
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
        const normalizedText = components.join('');
        const tail = components.length - 1;
        let lastComponent = components[0]!;

        for (let i = 1; i <= tail; i++) {
          const component = components[i]!;
          holes.push({
            type: TextType,
            index: nodeIndex,
            leadingSpan: lastComponent.length,
            trailingSpan: i === tail ? component.length : 0,
          });
          lastComponent = component;
        }

        if (normalizedText === '' && components.length === 1) {
          nextNode = sourceTree.nextNode();
          (currentNode as Text).remove();
          continue;
        }

        (currentNode as Text).data = normalizedText;

        break;
      }
    }

    nextNode = sourceTree.nextNode();
    nodeIndex++;
  }

  return holes;
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
