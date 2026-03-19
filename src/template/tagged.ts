import {
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
  type Part,
  type Slot,
  type TemplateMode,
  type TemplateResult,
  type UpdateSession,
} from '../core.js';
import { emphasizeNode } from '../debug/node.js';
import { formatPart } from '../debug/part.js';
import {
  createTreeWalker,
  replaceMarkerNode,
  splitText,
  treatNodeName,
  treatNodeType,
} from '../hydration.js';
import {
  createAttributePart,
  createChildNodePart,
  createElementPart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  createTextPart,
  getNamespaceURIByTagName,
} from '../part.js';
import { AbstractTemplate } from './template.js';

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
    type: typeof PART_TYPE_ATTRIBUTE;
    index: number;
    name: string;
  }

  export interface ChildNodeHole {
    type: typeof PART_TYPE_CHILD_NODE;
    index: number;
  }

  export interface ElementHole {
    type: typeof PART_TYPE_ELEMENT;
    index: number;
  }

  export interface EventHole {
    type: typeof PART_TYPE_EVENT;
    index: number;
    name: string;
  }

  export interface LiveHole {
    type: typeof PART_TYPE_LIVE;
    index: number;
    name: string;
  }

  export interface PropertyHole {
    type: typeof PART_TYPE_PROPERTY;
    index: number;
    name: string;
  }

  export interface TextHole {
    type: typeof PART_TYPE_TEXT;
    index: number;
    precedingText: string;
    followingText: string;
  }
}

const MARKER_IDENTIFIER_PATTERN = /^[0-9a-z_-]+$/;

// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
const ATTRIBUTE_NAME_CHARS = String.raw`[^ "'>/=\p{Control}\p{Noncharacter_Code_Point}]`;
// https://infra.spec.whatwg.org/#ascii-whitespace
const WHITESPACE_CHARS = String.raw`[\t\n\f\r ]`;
const QUOTE_CHARS = `["']`;

const ATTRIBUTE_NAME_PATTERN = new RegExp(
  `${ATTRIBUTE_NAME_CHARS}+(?=${WHITESPACE_CHARS}*=${WHITESPACE_CHARS}*${QUOTE_CHARS}?$)`,
  'u',
);

const ERROR_MAKER = '[[ERROR IN HERE!]]';

const LEADING_NEWLINE_PATTERN = /^\s*\n/;
const TAILING_NEWLINE_PATTERN = /\n\s*$/;

export class TaggedTemplate<
  TValues extends readonly unknown[] = unknown[],
> extends AbstractTemplate<TValues> {
  private readonly _template: HTMLTemplateElement;

  private readonly _holes: Hole[];

  private readonly _mode: TemplateMode;

  static parse<TValues extends readonly unknown[]>(
    strings: readonly string[],
    values: TValues,
    markerIdentifier: string,
    mode: TemplateMode,
    document: Document,
  ): TaggedTemplate<TValues> {
    const template = document.createElement('template');
    const marker = createMarker(markerIdentifier);
    const htmlString = stripWhitespaces(strings.join(marker));

    if (mode === 'html') {
      template.setHTMLUnsafe(htmlString);
    } else {
      template.setHTMLUnsafe(`<${mode}>${htmlString}</${mode}>`);
      template.content.replaceChildren(
        ...template.content.firstChild!.childNodes,
      );
    }

    const holes = parseChildren(strings, values, marker, template.content);

    return new TaggedTemplate(template, holes, mode);
  }

  constructor(
    template: HTMLTemplateElement,
    holes: Hole[],
    mode: TemplateMode,
  ) {
    super();
    this._template = template;
    this._holes = holes;
    this._mode = mode;
  }

  get arity(): number {
    return this._holes.length;
  }

  hydrate(
    values: TValues,
    part: Part.ChildNodePart,
    targetTree: TreeWalker,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const { ownerDocument } = part.sentinelNode;
    const fragment = this._template.content;
    const sourceTree = createTreeWalker(fragment);
    const holes = this._holes;
    const totalHoles = holes.length;
    const children: ChildNode[] = [];
    const slots: Slot<unknown>[] = new Array(totalHoles);
    let nodeIndex = 0;
    let holeIndex = 0;
    let lastHoleIndex = -1;

    for (
      let sourceNode: Node | null;
      (sourceNode = sourceTree.nextNode()) !== null;
      nodeIndex++
    ) {
      let currentPart: Part | null = null;

      for (; holeIndex < totalHoles; holeIndex++) {
        const hole = holes[holeIndex]!;
        if (hole.index !== nodeIndex) {
          break;
        }

        if (hole.type === PART_TYPE_TEXT) {
          currentPart = createTextPart(
            splitText(targetTree),
            hole.precedingText,
            hole.followingText,
          );
        } else if (hole.type === PART_TYPE_CHILD_NODE) {
          currentPart = createChildNodePart(
            ownerDocument.createComment(''),
            getNamespaceURI(targetTree.currentNode, this._mode),
          );
        } else {
          const currentNode =
            hole.index === lastHoleIndex
              ? (targetTree.currentNode as Element)
              : treatNodeType(
                  Node.ELEMENT_NODE,
                  targetTree.nextNode(),
                  targetTree,
                );
          switch (hole.type) {
            case PART_TYPE_ATTRIBUTE:
              currentPart = createAttributePart(currentNode, hole.name);
              break;
            case PART_TYPE_EVENT:
              currentPart = createEventPart(currentNode, hole.name);
              break;
            case PART_TYPE_ELEMENT:
              currentPart = createElementPart(currentNode);
              break;
            case PART_TYPE_LIVE:
              currentPart = createLivePart(currentNode, hole.name);
              break;
            case PART_TYPE_PROPERTY:
              currentPart = createPropertyPart(currentNode, hole.name);
              break;
          }
        }

        const slot = context.resolveSlot(values[holeIndex]!, currentPart!);
        slot.attach(session);

        if (currentPart!.type === PART_TYPE_CHILD_NODE) {
          replaceMarkerNode(targetTree, currentPart!.sentinelNode);
        }

        slots[holeIndex] = slot;
        lastHoleIndex = hole.index;
      }

      const targetNode =
        currentPart !== null
          ? targetTree.currentNode
          : treatNodeName(
              sourceNode.nodeName,
              targetTree.nextNode(),
              targetTree,
            );

      if (sourceNode.parentNode === fragment) {
        children.push(targetNode as ChildNode);
      }
    }

    if (holeIndex < totalHoles) {
      throw new Error(
        'There is no node that the hole indicates. The template may have been modified.',
      );
    }

    return { children, slots };
  }

  render(
    values: TValues,
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const { ownerDocument } = part.sentinelNode;
    const fragment = ownerDocument.importNode(this._template.content, true);
    const holes = this._holes;
    const slots: Slot<unknown>[] = new Array(holes.length);

    if (holes.length > 0) {
      const sourceTree = createTreeWalker(fragment);
      let nodeIndex = 0;

      for (let i = 0, l = holes.length; i < l; i++) {
        const hole = holes[i]!;

        for (; nodeIndex <= hole.index; nodeIndex++) {
          if (sourceTree.nextNode() === null) {
            throw new Error(
              'There is no node that the hole indicates. The template may have been modified.',
            );
          }
        }

        let currentPart: Part;

        switch (hole.type) {
          case PART_TYPE_ATTRIBUTE:
            currentPart = createAttributePart(
              sourceTree.currentNode as Element,
              hole.name,
            );
            break;
          case PART_TYPE_EVENT:
            currentPart = createEventPart(
              sourceTree.currentNode as Element,
              hole.name,
            );
            break;
          case PART_TYPE_CHILD_NODE:
            currentPart = createChildNodePart(
              sourceTree.currentNode as Comment,
              getNamespaceURI(sourceTree.currentNode, this._mode),
            );
            break;
          case PART_TYPE_ELEMENT:
            currentPart = createElementPart(sourceTree.currentNode as Element);
            break;
          case PART_TYPE_LIVE:
            currentPart = createLivePart(
              sourceTree.currentNode as Element,
              hole.name,
            );
            break;
          case PART_TYPE_PROPERTY:
            currentPart = createPropertyPart(
              sourceTree.currentNode as Element,
              hole.name,
            );
            break;
          case PART_TYPE_TEXT:
            currentPart = createTextPart(
              sourceTree.currentNode as Text,
              hole.precedingText,
              hole.followingText,
            );
            break;
        }

        const slot = context.resolveSlot(values[i]!, currentPart);
        slot.attach(session);

        slots[i] = slot;
      }
    }

    const children = Array.from(fragment.childNodes);

    return { children, slots };
  }
}

function createMarker(markerIdentifier: string): string {
  // Marker Requirements:
  // - A marker starts with "?" to detect when it is used as a tag name. In that
  //   case, the tag is treated as a comment.
  //   https://html.spec.whatwg.org/multipage/parsing.html#parse-error-unexpected-question-mark-instead-of-tag-name
  // - A marker is lowercase to match attribute names.
  if (!MARKER_IDENTIFIER_PATTERN.test(markerIdentifier)) {
    throw new Error(
      `A marker identifier must match pattern ${MARKER_IDENTIFIER_PATTERN}, but got ${JSON.stringify(markerIdentifier)}.`,
    );
  }
  return '??' + markerIdentifier + '??';
}

function extractCaseSensitiveAttributeName(s: string): string | undefined {
  return s.match(ATTRIBUTE_NAME_PATTERN)?.[0];
}

function getNamespaceURI(node: Node, mode: TemplateMode): string | null {
  return node.lookupNamespaceURI(null) ?? getNamespaceURIByTagName(mode);
}

function parseAttribtues(
  element: Element,
  strings: readonly string[],
  marker: string,
  holes: Hole[],
  index: number,
): void {
  const names = element.getAttributeNames();

  for (const name of names) {
    const value = element.getAttribute(name)!;
    let hole: Hole;

    if (name === marker && value === '') {
      hole = {
        type: PART_TYPE_ELEMENT,
        index,
      };
    } else if (value === marker) {
      const caseSensitiveName = extractCaseSensitiveAttributeName(
        strings[holes.length]!,
      );

      DEBUG: {
        if (caseSensitiveName?.toLowerCase() !== name) {
          throw new Error(
            `The attribute name must be "${name}", but got "${caseSensitiveName}". There may be an unclosed tag or a duplicate attribute:\n` +
              formatPart(
                { type: PART_TYPE_ATTRIBUTE, name, node: element },
                ERROR_MAKER,
              ),
          );
        }
      }

      switch (caseSensitiveName[0]) {
        case '@':
          hole = {
            type: PART_TYPE_EVENT,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '$':
          hole = {
            type: PART_TYPE_LIVE,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '.':
          hole = {
            type: PART_TYPE_PROPERTY,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        default:
          hole = {
            type: PART_TYPE_ATTRIBUTE,
            index,
            name: caseSensitiveName,
          };
          break;
      }
    } else {
      DEBUG: {
        if (name.includes(marker)) {
          throw new Error(
            'Expressions are not allowed as an attribute name:\n' +
              formatPart(
                {
                  type: PART_TYPE_ATTRIBUTE,
                  name,
                  node: element,
                },
                ERROR_MAKER,
              ),
          );
        }

        if (value.includes(marker)) {
          throw new Error(
            'Expressions inside an attribute must make up the entire attribute value:\n' +
              formatPart(
                {
                  type: PART_TYPE_ATTRIBUTE,
                  name,
                  node: element,
                },
                ERROR_MAKER,
              ),
          );
        }
      }
      continue;
    }

    holes.push(hole);
    element.removeAttribute(name);
  }
}

function parseChildren(
  strings: readonly string[],
  values: readonly unknown[],
  marker: string,
  fragment: DocumentFragment,
): Hole[] {
  const document = fragment.ownerDocument!;
  const sourceTree = createTreeWalker(fragment);
  const holes: Hole[] = [];
  let nextNode = sourceTree.nextNode() as ChildNode | null;
  let index = 0;

  while (nextNode !== null) {
    const currentNode = nextNode;
    switch (currentNode.nodeType) {
      case Node.ELEMENT_NODE: {
        DEBUG: {
          if ((currentNode as Element).localName.includes(marker)) {
            throw new Error(
              'Expressions are not allowed as a tag name:\n' +
                formatPart(
                  { type: PART_TYPE_ELEMENT, node: currentNode as Element },
                  ERROR_MAKER,
                ),
            );
          }
        }
        if ((currentNode as Element).hasAttributes()) {
          parseAttribtues(
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
            type: PART_TYPE_CHILD_NODE,
            index,
          });
          (currentNode as Comment).data = '';
        } else {
          DEBUG: {
            if ((currentNode as Comment).data.includes(marker)) {
              throw new Error(
                'Expressions inside a comment must make up the entire comment value:\n' +
                  emphasizeNode(currentNode, ERROR_MAKER),
              );
            }
          }
        }
        break;
      }
      case Node.TEXT_NODE: {
        const normalizedText = stripWhitespaces((currentNode as Text).data);
        if (normalizedText === '') {
          nextNode = sourceTree.nextNode() as ChildNode | null;
          currentNode.remove();
          continue;
        }

        const components = normalizedText.split(marker);
        if (components.length > 1) {
          const tail = components.length - 1;
          let lastComponent = components[0]!;

          for (let i = 1; i < tail; i++) {
            holes.push({
              type: PART_TYPE_TEXT,
              index,
              precedingText: stripWhitespaces(lastComponent),
              followingText: '',
            });
            currentNode.before(document.createTextNode(''));
            lastComponent = components[i]!;
            index++;
          }

          holes.push({
            type: PART_TYPE_TEXT,
            index,
            precedingText: stripWhitespaces(lastComponent),
            followingText: stripWhitespaces(components[tail]!),
          });
          (currentNode as Text).data = '';
        } else {
          (currentNode as Text).data = normalizedText;
        }

        break;
      }
    }

    nextNode = sourceTree.nextNode() as ChildNode | null;
    index++;
  }

  if (values.length !== holes.length) {
    throw new Error(
      `The number of holes must be ${values.length}, but got ${holes.length}. There may be multiple holes indicating the same attribute:\n` +
        // biome-ignore lint/suspicious/noTemplateCurlyInString: "${...}" represents a template literal hole
        strings.join('${...}').trim(),
    );
  }

  return holes;
}

function stripTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}

function stripWhitespaces(text: string): string {
  if (LEADING_NEWLINE_PATTERN.test(text)) {
    text = text.trimStart();
  }
  if (TAILING_NEWLINE_PATTERN.test(text)) {
    text = text.trimEnd();
  }
  return text;
}
