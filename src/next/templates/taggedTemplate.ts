import type {
  Bindable,
  DirectiveContext,
  Slot,
  Template,
  TemplateBlock,
  TemplateMode,
  TemplateSlots,
  UpdateContext,
} from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import {
  type HydrationTree,
  ensureComment,
  ensureElement,
  ensureText,
} from '../hydration.js';
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

export class TaggedTemplate<TBinds extends readonly Bindable<unknown>[]>
  implements Template<TBinds>
{
  static parse<TBinds extends readonly Bindable<unknown>[]>(
    strings: readonly string[],
    binds: TBinds,
    placeholder: string,
    mode: TemplateMode,
    document: Document,
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

  private constructor(element: HTMLTemplateElement, holes: Hole[]) {
    this._element = element;
    this._holes = holes;
  }

  get name(): string {
    return 'TaggedTemplate';
  }

  get element(): HTMLTemplateElement {
    return this._element;
  }

  get holes(): Hole[] {
    return this._holes;
  }

  hydrate(
    binds: TBinds,
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateBlock<TBinds> {
    const holes = this._holes;
    const rootNode = this._element.content;
    const document = part.node.ownerDocument;

    DEBUG: {
      assertNumberOfBinds(holes.length, binds.length);
    }

    const treeWalker = document.createTreeWalker(
      rootNode,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
    const slots: Slot<unknown>[] = new Array(holes.length);
    const childNodes = [];
    let currentNode: Node | null;
    let nodeIndex = 0;
    let holeIndex = 0;

    OUTER: while ((currentNode = treeWalker.nextNode()) !== null) {
      let part: Part | null = null;
      const lookaheadNode = hydrationTree.peekNode();

      while (holeIndex < holes.length) {
        const hole = holes[holeIndex]!;
        if (hole.index !== nodeIndex) {
          break;
        }

        switch (hole.type) {
          case PartType.Attribute:
            part = {
              type: PartType.Attribute,
              node: ensureElement(
                lookaheadNode,
                (currentNode as Element).tagName,
              ),
              name: hole.name,
            };
            break;
          case PartType.ChildNode:
            part = {
              type: PartType.ChildNode,
              node: document.createComment(''),
              childNode: null,
            };
            break;
          case PartType.Element:
            part = {
              type: PartType.Element,
              node: ensureElement(
                lookaheadNode,
                (currentNode as Element).tagName,
              ),
            };
            break;
          case PartType.Event:
            part = {
              type: PartType.Event,
              node: ensureElement(
                lookaheadNode,
                (currentNode as Element).tagName,
              ),
              name: hole.name,
            };
            break;
          case PartType.Live:
            part = {
              type: PartType.Live,
              node: ensureElement(
                lookaheadNode,
                (currentNode as Element).tagName,
              ),
              name: hole.name,
            };
            break;
          case PartType.Property:
            part = {
              type: PartType.Property,
              node: ensureElement(
                lookaheadNode,
                (currentNode as Element).tagName,
              ),
              name: hole.name,
            };
            break;
          case PartType.Text:
            part = {
              type: PartType.Text,
              node: ensureText(lookaheadNode),
            };
            break;
        }

        const slot = context.resolveSlot(binds[holeIndex], part);
        slots[holeIndex] = slot;
        slot.hydrate(hydrationTree, context);

        holeIndex++;
      }

      const consumedNode = hydrationTree.popNode();

      if (part?.type === PartType.ChildNode) {
        ensureComment(consumedNode).replaceWith(part.node);
      } else {
        if (currentNode.parentNode === rootNode) {
          childNodes.push(consumedNode);
        }
      }

      nodeIndex++;
    }

    return { childNodes, slots: slots as TemplateSlots<TBinds> };
  }

  render(
    binds: TBinds,
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateBlock<TBinds> {
    const holes = this._holes;
    const document = part.node.ownerDocument;

    DEBUG: {
      assertNumberOfBinds(holes.length, binds.length);
    }

    const slots: Slot<unknown>[] = new Array(holes.length);
    const fragment = document.importNode(this._element.content, true);

    if (holes.length > 0) {
      const treeWalker = document.createTreeWalker(
        fragment,
        NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT |
          NodeFilter.SHOW_COMMENT,
      );
      let currentNode: Node | null;
      let currentHole: Hole = holes[0]!;
      let holeIndex = 0;
      let nodeIndex = 0;

      OUTER: while ((currentNode = treeWalker.nextNode()) !== null) {
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
                childNode: null,
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
            case PartType.Live:
              part = {
                type: PartType.Live,
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
            case PartType.Property:
              part = {
                type: PartType.Property,
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
            case PartType.Text:
              part = {
                type: PartType.Text,
                node: currentNode as Text,
              };
              break;
          }

          const slot = context.resolveSlot(binds[holeIndex], part);
          slot.connect(context);

          slots[holeIndex] = slot;
          holeIndex++;

          if (holeIndex >= holes.length) {
            break OUTER;
          }

          currentHole = holes[holeIndex]!;
        }

        nodeIndex++;
      }
    }

    const childNodes = Array.from(fragment.childNodes);

    // Detach child nodes from the fragment.
    fragment.replaceChildren();

    return { childNodes, slots: slots as TemplateSlots<TBinds> };
  }

  resolveBinding(
    binds: TBinds,
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<TBinds> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'TaggedTemplate must be used in a child node, but it is used here in:\n' +
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
  DEBUG: {
    if (!PLACEHOLDER_REGEXP.test(placeholder)) {
      throw new Error(
        `The placeholder must match pattern ${PLACEHOLDER_REGEXP.toString()}, but got ${JSON.stringify(placeholder)}.`,
      );
    }
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
  const attributes = [...element.attributes];

  for (let i = 0, l = attributes.length; i < l; i++) {
    const attribute = attributes[i]!;
    const name = attribute.name;
    const value = attribute.value;
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
          type: PartType.Event,
          index,
          name: caseSensitiveName.slice(1),
        };
      } else if (caseSensitiveName[0] === '$' && caseSensitiveName.length > 1) {
        hole = {
          type: PartType.Live,
          index,
          name: caseSensitiveName.slice(1),
        };
        break;
      } else if (caseSensitiveName[0] === '.' && caseSensitiveName.length > 1) {
        hole = {
          type: PartType.Property,
          index,
          name: caseSensitiveName.slice(1),
        };
        break;
      } else {
        hole = {
          type: PartType.Attribute,
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
  const treeWalker = rootNode.ownerDocument!.createTreeWalker(
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
          (currentNode as Comment).data = '';
          holes.push({
            type: PartType.ChildNode,
            index,
          });
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
              type: PartType.Text,
              index,
            });
            index++;
          }

          const tailComponent = components[tailCompoent]!;

          if (tailComponent !== '') {
            // Reuse the current node.
            (currentNode as Text).data = tailComponent;
          } else {
            treeWalker.currentNode = currentNode.previousSibling!;
            (currentNode as Text).remove();
            index--;
          }
        }

        break;
      }
    }
    index++;
  }

  DEBUG: {
    assertNumberOfHoles(binds.length, holes.length, strings);
  }

  return holes;
}

function trimTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}
