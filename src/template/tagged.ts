import { formatNode } from '../debug/node.js';
import { formatPart } from '../debug/part.js';
import {
  mountMarkerNode,
  splitText,
  treatNodeName,
  treatNodeType,
} from '../hydration.js';
import {
  type HydrationTarget,
  type Part,
  PartType,
  type Slot,
  type TemplateMode,
  type TemplateResult,
  type UpdateSession,
} from '../internal.js';
import {
  AbstractTemplate,
  getNamespaceURIByTagName,
  stripWhitespaces,
} from './template.js';

export type Hole =
  | AttributeHole
  | ChildNodeHole
  | ElementHole
  | EventHole
  | LiveHole
  | PropertyHole
  | TextHole;

export interface AttributeHole {
  type: typeof PartType.Attribute;
  index: number;
  name: string;
}

export interface ChildNodeHole {
  type: typeof PartType.ChildNode;
  index: number;
}

export interface ElementHole {
  type: typeof PartType.Element;
  index: number;
}

export interface EventHole {
  type: typeof PartType.Event;
  index: number;
  name: string;
}

export interface LiveHole {
  type: typeof PartType.Live;
  index: number;
  name: string;
}

export interface PropertyHole {
  type: typeof PartType.Property;
  index: number;
  name: string;
}

export interface TextHole {
  type: typeof PartType.Text;
  index: number;
  precedingText: string;
  followingText: string;
}

const PLACEHOLDER_PATTERN = /^[0-9a-z_-]+$/;

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

export class TaggedTemplate<
  TBinds extends readonly unknown[] = unknown[],
> extends AbstractTemplate<TBinds> {
  static parse<TBinds extends readonly unknown[]>(
    strings: readonly string[],
    binds: TBinds,
    placeholder: string,
    mode: TemplateMode,
    document: Document,
  ): TaggedTemplate<TBinds> {
    const template = document.createElement('template');
    const marker = createMarker(placeholder);

    if (mode === 'html') {
      template.innerHTML = stripWhitespaces(strings.join(marker));
    } else {
      template.innerHTML =
        '<' +
        mode +
        '>' +
        stripWhitespaces(strings.join(marker)) +
        '</' +
        mode +
        '>';
      template.content.replaceChildren(
        ...template.content.firstChild!.childNodes,
      );
    }

    const holes = parseChildren(strings, binds, marker, template.content);

    return new TaggedTemplate(template, holes, mode);
  }

  private readonly _template: HTMLTemplateElement;

  private readonly _holes: Hole[];

  private readonly _mode: TemplateMode;

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
    binds: TBinds,
    part: Part.ChildNodePart,
    target: HydrationTarget,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const document = part.node.ownerDocument;
    const fragment = this._template.content;
    const sourceTree = createTreeWalker(fragment);
    const holes = this._holes;
    const totalHoles = holes.length;
    const childNodes: ChildNode[] = [];
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

        const continuous = hole.index === lastHoleIndex;

        switch (hole.type) {
          case PartType.Attribute:
          case PartType.Event:
            currentPart = {
              type: hole.type,
              node: treatNodeType(
                Node.ELEMENT_NODE,
                continuous ? target.currentNode : target.nextNode(),
                target,
              ),
              name: hole.name,
            };
            break;
          case PartType.ChildNode:
            currentPart = {
              type: hole.type,
              node: document.createComment(''),
              anchorNode: null,
              namespaceURI: getNamespaceURI(target.currentNode, this._mode),
            };
            break;
          case PartType.Element:
            currentPart = {
              type: hole.type,
              node: treatNodeType(
                Node.ELEMENT_NODE,
                continuous ? target.currentNode : target.nextNode(),
                target,
              ),
            };
            break;
          case PartType.Live:
          case PartType.Property: {
            const node = treatNodeType(
              Node.ELEMENT_NODE,
              continuous ? target.currentNode : target.nextNode(),
              target,
            );
            currentPart = {
              type: hole.type,
              node,
              name: hole.name,
              defaultValue: (node as any)[hole.name],
            };
            break;
          }
          case PartType.Text:
            currentPart = {
              type: hole.type,
              node: splitText(target),
              precedingText: hole.precedingText,
              followingText: hole.followingText,
            };
            break;
        }

        const slot = context.resolveSlot(binds[holeIndex]!, currentPart!);
        slot.connect(session);

        if (currentPart!.type === PartType.ChildNode) {
          mountMarkerNode(target, currentPart!.node);
        }

        slots[holeIndex] = slot;
        lastHoleIndex = hole.index;
      }

      const targetNode =
        currentPart !== null
          ? target.currentNode
          : treatNodeName(sourceNode.nodeName, target.nextNode(), target);

      if (sourceNode.parentNode === fragment) {
        childNodes.push(targetNode as ChildNode);
      }
    }

    if (holeIndex < totalHoles) {
      throw new Error(
        'There is no node that the hole indicates. This may be a bug or the template may have been modified.',
      );
    }

    return { childNodes, slots };
  }

  render(
    binds: TBinds,
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult {
    const { context } = session;
    const document = part.node.ownerDocument;
    const fragment = document.importNode(this._template.content, true);
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
              'There is no node that the hole indicates. This may be a bug or the template may have been modified.',
            );
          }
        }

        let currentPart: Part;

        switch (hole.type) {
          case PartType.Attribute:
          case PartType.Event:
            currentPart = {
              type: hole.type,
              node: sourceTree.currentNode as Element,
              name: hole.name,
            };
            break;
          case PartType.ChildNode:
            currentPart = {
              type: hole.type,
              node: sourceTree.currentNode as Comment,
              anchorNode: null,
              namespaceURI: getNamespaceURI(sourceTree.currentNode, this._mode),
            };
            break;
          case PartType.Element:
            currentPart = {
              type: hole.type,
              node: sourceTree.currentNode as Element,
            };
            break;
          case PartType.Live:
          case PartType.Property:
            currentPart = {
              type: hole.type,
              node: sourceTree.currentNode as Element,
              name: hole.name,
              defaultValue: (sourceTree.currentNode as any)[hole.name],
            };
            break;
          case PartType.Text:
            currentPart = {
              type: PartType.Text,
              node: sourceTree.currentNode as Text,
              precedingText: hole.precedingText,
              followingText: hole.followingText,
            };
            break;
        }

        const slot = context.resolveSlot(binds[i]!, currentPart);
        slot.connect(session);

        slots[i] = slot;
      }
    }

    const childNodes = Array.from(fragment.childNodes);

    return { childNodes, slots };
  }
}

function createMarker(placeholder: string): string {
  // Marker Requirements:
  // - A marker starts with "?" to detect when it is used as a tag name. In that
  //   case, the tag is treated as a comment.
  //   https://html.spec.whatwg.org/multipage/parsing.html#parse-error-unexpected-question-mark-instead-of-tag-name
  // - A marker is lowercase to match attribute names.
  if (!PLACEHOLDER_PATTERN.test(placeholder)) {
    throw new Error(
      `The placeholder is in an invalid format. It must match pattern ${PLACEHOLDER_PATTERN.toString()}, but got ${JSON.stringify(placeholder)}.`,
    );
  }
  return '??' + placeholder + '??';
}

function createTreeWalker(node: Node): TreeWalker {
  return node.ownerDocument!.createTreeWalker(
    node,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
}

function extractCaseSensitiveAttributeName(s: string): string {
  /* v8 ignore next @preserve */
  return s.match(ATTRIBUTE_NAME_PATTERN)?.[0] ?? s;
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
  const attributeNames = element.getAttributeNames();

  for (let i = 0, l = attributeNames.length; i < l; i++) {
    const name = attributeNames[i]!;
    const value = element.getAttribute(name)!;
    let hole: Hole;

    if (name === marker && value === '') {
      hole = {
        type: PartType.Element,
        index,
      };
    } else if (value === marker) {
      const caseSensitiveName = extractCaseSensitiveAttributeName(
        strings[holes.length]!,
      );

      DEBUG: {
        if (caseSensitiveName.toLowerCase() !== name) {
          throw new Error(
            `The attribute name must be "${name}", but got "${caseSensitiveName}". There may be a unclosed tag or a duplicate attribute:\n` +
              formatPart(
                { type: PartType.Attribute, name, node: element },
                ERROR_MAKER,
              ),
          );
        }
      }

      switch (caseSensitiveName[0]) {
        case '@':
          hole = {
            type: PartType.Event,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '$':
          hole = {
            type: PartType.Live,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '.':
          hole = {
            type: PartType.Property,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        default:
          hole = {
            type: PartType.Attribute,
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
                  type: PartType.Attribute,
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
                  type: PartType.Attribute,
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
  binds: readonly unknown[],
  marker: string,
  rootNode: Node,
): Hole[] {
  const document = rootNode.ownerDocument!;
  const sourceTree = createTreeWalker(rootNode);
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
                  { type: PartType.Element, node: currentNode as Element },
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
            type: PartType.ChildNode,
            index,
          });
          (currentNode as Comment).data = '';
        } else {
          DEBUG: {
            if ((currentNode as Comment).data.includes(marker)) {
              throw new Error(
                'Expressions inside a comment must make up the entire comment value:\n' +
                  formatNode(currentNode, ERROR_MAKER),
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
              type: PartType.Text,
              index,
              precedingText: stripWhitespaces(lastComponent),
              followingText: '',
            });
            currentNode.before(document.createTextNode(''));
            lastComponent = components[i]!;
            index++;
          }

          holes.push({
            type: PartType.Text,
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

  if (binds.length !== holes.length) {
    throw new Error(
      `The number of holes must be ${binds.length}, but got ${holes.length}. There may be multiple holes indicating the same attribute:\n` +
        strings.join('${...}').trim(),
    );
  }

  return holes;
}

function stripTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}
