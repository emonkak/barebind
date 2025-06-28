import { inspectPart, markUsedValue } from '../debug.js';
import type {
  DirectiveContext,
  Slot,
  Template,
  TemplateBlock,
  TemplateMode,
  UpdateContext,
} from '../directive.js';
import { ensureNode, type HydrationTree } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from './template.js';

export type Hole =
  | AttributeHole
  | ChildNodeHole
  | ElementHole
  | EventHole
  | LiveHole
  | PropertyHole
  | TextHole;

export const HoleType = {
  Attribute: 0,
  ChildNode: 1,
  Element: 2,
  Event: 3,
  Live: 4,
  Property: 5,
  Text: 6,
} as const;

export type HoleType = (typeof HoleType)[keyof typeof HoleType];

export interface AttributeHole {
  type: typeof HoleType.Attribute;
  index: number;
  name: string;
}

export interface ChildNodeHole {
  type: typeof HoleType.ChildNode;
  index: number;
}

export interface ElementHole {
  type: typeof HoleType.Element;
  index: number;
}

export interface EventHole {
  type: typeof HoleType.Event;
  index: number;
  name: string;
}

export interface LiveHole {
  type: typeof HoleType.Live;
  index: number;
  name: string;
}

export interface PropertyHole {
  type: typeof HoleType.Property;
  index: number;
  name: string;
}

export interface TextHole {
  type: typeof HoleType.Text;
  index: number;
}

const PLACEHOLDER_REGEXP = /^[0-9a-z_-]+$/;

// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
const ATTRIBUTE_NAME_CHARS = String.raw`[^ "'>/=\p{Control}\p{Noncharacter_Code_Point}]`;
// https://infra.spec.whatwg.org/#ascii-whitespace
const WHITESPACE_CHARS = String.raw`[\t\n\f\r ]`;

const ATTRIBUTE_NAME_REGEXP = new RegExp(
  `(${ATTRIBUTE_NAME_CHARS}+)${WHITESPACE_CHARS}*=${WHITESPACE_CHARS}*["']?$`,
  'u',
);

const ERROR_MAKER = '[[ERROR IN HERE!]]';

export class TaggedTemplate<TBinds extends readonly unknown[] = unknown[]>
  implements Template<TBinds>
{
  static parse<TBinds extends readonly unknown[]>(
    strings: readonly string[],
    binds: TBinds,
    placeholder: string,
    mode: TemplateMode,
    document: Document = globalThis.document,
  ): TaggedTemplate<TBinds> {
    const template = document.createElement('template');
    const marker = createMarker(placeholder);

    if (mode === 'html') {
      template.innerHTML = strings.join(marker).trim();
    } else {
      template.innerHTML =
        '<' + mode + '>' + strings.join(marker).trim() + '</' + mode + '>';
      template.content.replaceChildren(
        ...template.content.firstChild!.childNodes,
      );
    }

    const holes =
      binds.length > 0
        ? parseChildren(strings, binds, marker, template.content)
        : [];

    return new TaggedTemplate(template, holes);
  }

  private readonly _element: HTMLTemplateElement;

  private readonly _holes: Hole[];

  constructor(element: HTMLTemplateElement, holes: Hole[]) {
    this._element = element;
    this._holes = holes;
  }

  get name(): string {
    return 'TaggedTemplate';
  }

  hydrate(
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateBlock {
    const holes = this._holes;

    assertNumberOfBinds(holes.length, binds.length);

    const document = part.node.ownerDocument;
    const rootNode = this._element.content;
    const treeWalker = document.createTreeWalker(
      rootNode,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
    const slots: Slot<unknown>[] = new Array(holes.length);
    const childNodes: ChildNode[] = [];

    OUTER: for (
      let currentNode, nodeIndex = 0, holeIndex = 0, holesLength = holes.length;
      (currentNode = treeWalker.nextNode()) !== null;
      nodeIndex++
    ) {
      const lookaheadNode = hydrationTree.peekNode();
      let part: Part | null = null;

      for (; holeIndex < holesLength; holeIndex++) {
        const hole = holes[holeIndex]!;
        if (hole.index !== nodeIndex) {
          break;
        }

        switch (hole.type) {
          case HoleType.Attribute:
            ensureNode(lookaheadNode, currentNode.nodeName);
            part = {
              type: PartType.Attribute,
              node: lookaheadNode as Element,
              name: hole.name,
            };
            break;
          case HoleType.ChildNode:
            part = {
              type: PartType.ChildNode,
              node: document.createComment(''),
              childNode: null,
            };
            break;
          case HoleType.Element:
            ensureNode(lookaheadNode, currentNode.nodeName);
            part = {
              type: PartType.Element,
              node: lookaheadNode as Element,
            };
            break;
          case HoleType.Event:
            ensureNode(lookaheadNode, currentNode.nodeName);
            part = {
              type: PartType.Event,
              node: lookaheadNode as Element,
              name: hole.name,
            };
            break;
          case HoleType.Live:
            ensureNode(lookaheadNode, currentNode.nodeName);
            part = {
              type: PartType.Live,
              node: lookaheadNode as Element,
              name: hole.name,
              defaultValue: lookaheadNode[hole.name as keyof Node],
            };
            break;
          case HoleType.Property:
            ensureNode(lookaheadNode, currentNode.nodeName);
            part = {
              type: PartType.Property,
              node: lookaheadNode as Element,
              name: hole.name,
              defaultValue: lookaheadNode[hole.name as keyof Node],
            };
            break;
          case HoleType.Text:
            ensureNode(lookaheadNode, currentNode.nodeName);
            part = {
              type: PartType.Text,
              node: lookaheadNode as Text,
            };
            break;
        }

        const slot = context.resolveSlot(binds[holeIndex]!, part);
        slots[holeIndex] = slot;
        slot.hydrate(hydrationTree, context);
      }

      const consumedNode = hydrationTree.popNode(currentNode.nodeName);

      if (part?.type === PartType.ChildNode) {
        hydrationTree.replaceNode(part.node);
      } else {
        if (currentNode.parentNode === rootNode) {
          childNodes.push(consumedNode);
        }
      }
    }

    return { childNodes, slots };
  }

  render(
    binds: TBinds,
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateBlock {
    const holes = this._holes;

    assertNumberOfBinds(holes.length, binds.length);

    const document = part.node.ownerDocument;
    const fragment = document.importNode(this._element.content, true);
    const slots: Slot<unknown>[] = new Array(holes.length);

    if (holes.length > 0) {
      const treeWalker = document.createTreeWalker(
        fragment,
        NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT |
          NodeFilter.SHOW_COMMENT,
      );

      OUTER: for (
        let holeIndex = 0, holesLength = holes.length, nodeIndex = -1;
        holeIndex < holesLength;
        holeIndex++
      ) {
        const currentHole = holes[holeIndex]!;
        let currentNode: Node | null = treeWalker.currentNode;

        while (currentHole.index !== nodeIndex) {
          currentNode = treeWalker.nextNode();
          if (currentNode === null) {
            throw new Error(
              'There is no node that the hole points. This might be a bug.',
            );
          }
          nodeIndex++;
        }

        let part: Part;

        switch (currentHole.type) {
          case HoleType.Attribute:
            part = {
              type: PartType.Attribute,
              node: currentNode as Element,
              name: currentHole.name,
            };
            break;
          case HoleType.ChildNode:
            part = {
              type: PartType.ChildNode,
              node: currentNode as Comment,
              childNode: null,
            };
            break;
          case HoleType.Element:
            part = {
              type: PartType.Element,
              node: currentNode as Element,
            };
            break;
          case HoleType.Event:
            part = {
              type: PartType.Event,
              node: currentNode as Element,
              name: currentHole.name,
            };
            break;
          case HoleType.Live:
            part = {
              type: PartType.Live,
              node: currentNode as Element,
              name: currentHole.name,
              defaultValue: currentNode[currentHole.name as keyof Node],
            };
            break;
          case HoleType.Property:
            part = {
              type: PartType.Property,
              node: currentNode as Element,
              name: currentHole.name,
              defaultValue: currentNode[currentHole.name as keyof Node],
            };
            break;
          case HoleType.Text:
            part = {
              type: PartType.Text,
              node: currentNode as Text,
            };
            break;
        }

        const slot = context.resolveSlot(binds[holeIndex]!, part);
        slots[holeIndex] = slot;
        slot.connect(context);
      }
    }

    const childNodes = Array.from(fragment.childNodes);

    // Detach child nodes from the fragment.
    fragment.replaceChildren();

    return { childNodes, slots };
  }

  resolveBinding(
    binds: TBinds,
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<TBinds> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'TaggedTemplate must be used in a child node part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(binds)),
      );
    }
    return new TemplateBinding(this, binds, part);
  }
}

function assertNumberOfBinds(
  expectedLength: number,
  actualLength: number,
): void {
  if (expectedLength !== actualLength) {
    throw new Error(
      `The number of binds must be ${expectedLength}, but got ${actualLength}. There may be multiple holes indicating the same attribute.`,
    );
  }
}

function assertNumberOfHoles(
  expectedLength: number,
  actualLength: number,
  strings: readonly string[],
): void {
  if (expectedLength !== actualLength) {
    throw new Error(
      `The number of holes must be ${expectedLength}, but got ${actualLength}. There may be multiple holes indicating the same attribute:\n` +
        strings.join('${...}').trim(),
    );
  }
}

function createMarker(placeholder: string): string {
  // Marker Requirements:
  // - A marker starts with "?" to detect when it is used as a tag name. In that
  //   case, the tag is treated as a comment.
  //   https://html.spec.whatwg.org/multipage/parsing.html#parse-error-unexpected-question-mark-instead-of-tag-name
  // - A marker is lowercase to match attribute names.
  if (!PLACEHOLDER_REGEXP.test(placeholder)) {
    throw new Error(
      `The placeholder is in an invalid format. It must match pattern ${PLACEHOLDER_REGEXP.toString()}, but got ${JSON.stringify(placeholder)}.`,
    );
  }
  return '??' + placeholder + '??';
}

function extractCaseSensitiveAttributeName(token: string): string | undefined {
  return ATTRIBUTE_NAME_REGEXP.exec(token)?.[1];
}

function parseAttribtues(
  element: Element,
  strings: readonly string[],
  marker: string,
  holes: Hole[],
  index: number,
): void {
  // Persist element attributes since ones may be removed.
  const attributes = Array.from(element.attributes);

  for (let i = 0, l = attributes.length; i < l; i++) {
    const attribute = attributes[i]!;
    const name = attribute.name;
    const value = attribute.value;
    let hole: Hole;

    if (name === marker && value === '') {
      hole = {
        type: HoleType.Element,
        index,
      };
    } else if (value === marker) {
      const caseSensitiveName = extractCaseSensitiveAttributeName(
        strings[holes.length]!,
      );

      DEBUG: {
        if (caseSensitiveName?.toLowerCase() !== name) {
          throw new Error(
            `The attribute name must be "${name}", but got "${caseSensitiveName}". There may be a unclosed tag or a duplicate attribute:\n` +
              inspectPart(
                { type: PartType.Attribute, name, node: element },
                ERROR_MAKER,
              ),
          );
        }
      }

      if (caseSensitiveName[0] === '@' && caseSensitiveName.length > 1) {
        hole = {
          type: HoleType.Event,
          index,
          name: caseSensitiveName.slice(1),
        };
      } else if (caseSensitiveName[0] === '$' && caseSensitiveName.length > 1) {
        hole = {
          type: HoleType.Live,
          index,
          name: caseSensitiveName.slice(1),
        };
      } else if (caseSensitiveName[0] === '.' && caseSensitiveName.length > 1) {
        hole = {
          type: HoleType.Property,
          index,
          name: caseSensitiveName.slice(1),
        };
      } else {
        hole = {
          type: HoleType.Attribute,
          index,
          name: caseSensitiveName,
        };
      }
    } else {
      DEBUG: {
        if (name.includes(marker)) {
          throw new Error(
            'Expressions are not allowed as an attribute name:\n' +
              inspectPart(
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
              inspectPart(
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
  const treeWalker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
  const holes: Hole[] = [];
  let currentNode: ChildNode | null;
  let index = 0;

  while ((currentNode = treeWalker.nextNode() as ChildNode | null) !== null) {
    switch (currentNode.nodeType) {
      case Node.ELEMENT_NODE: {
        DEBUG: {
          if ((currentNode as Element).tagName.includes(marker.toUpperCase())) {
            throw new Error(
              'Expressions are not allowed as a tag name:\n' +
                inspectPart(
                  { type: PartType.Element, node: currentNode as Element },
                  ERROR_MAKER,
                ),
            );
          }
        }
        parseAttribtues(currentNode as Element, strings, marker, holes, index);
        break;
      }
      case Node.COMMENT_NODE: {
        if (
          trimTrailingSlash((currentNode as Comment).data).trim() === marker
        ) {
          holes.push({
            type: HoleType.ChildNode,
            index,
          });
          (currentNode as Comment).data = '';
        } else {
          DEBUG: {
            if ((currentNode as Comment).data.includes(marker)) {
              throw new Error(
                'Expressions inside a comment must make up the entire comment value:\n' +
                  inspectPart(
                    {
                      type: PartType.ChildNode,
                      node: currentNode as Comment,
                      childNode: null,
                    },
                    ERROR_MAKER,
                  ),
              );
            }
          }
        }
        break;
      }
      case Node.TEXT_NODE: {
        const components = (currentNode as Text).data.split(marker);

        if (components.length > 1) {
          const tail = components.length - 1;

          for (let i = 0; i < tail; i++) {
            const component = components[i]!;

            if (component !== '') {
              currentNode.before(document.createTextNode(component));
              index++;
            }

            currentNode.before(document.createTextNode(''));
            holes.push({
              type: HoleType.Text,
              index,
            });
            index++;
          }

          const tailComponent = components[tail]!;

          if (tailComponent !== '') {
            // Reuse the current text node.
            (currentNode as Text).data = tailComponent;
          } else {
            // Discard the empty text node.
            treeWalker.previousNode();
            (currentNode as Text).remove();
            index--;
          }
        }

        break;
      }
    }
    index++;
  }

  assertNumberOfHoles(binds.length, holes.length, strings);

  return holes;
}

function trimTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}
