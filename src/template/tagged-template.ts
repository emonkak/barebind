import { inspectPart, markUsedValue } from '../debug.js';
import type {
  DirectiveContext,
  Slot,
  Template,
  TemplateMode,
  TemplateResult,
  UpdateContext,
} from '../directive.js';
import type { HydrationTree } from '../hydration.js';
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
  precedingText: string;
  followingText: string;
  split: boolean;
}

const PLACEHOLDER_REGEXP = /^[0-9a-z_-]+$/;

const ONLY_SPACES_REGEXP = /^[\s\n\r]*$/;

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

  private readonly _template: HTMLTemplateElement;

  private readonly _holes: Hole[];

  constructor(template: HTMLTemplateElement, holes: Hole[]) {
    this._template = template;
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
  ): TemplateResult {
    const holes = this._holes;

    assertNumberOfBinds(holes.length, binds.length);

    const document = part.node.ownerDocument;
    const rootNode = this._template.content;
    const treeWalker = document.createTreeWalker(
      rootNode,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
    const slots: Slot<unknown>[] = new Array(holes.length);
    const childNodes: ChildNode[] = [];

    for (
      let currentNode: Node | null,
        nodeIndex = 0,
        holeIndex = 0,
        holesLength = holes.length;
      (currentNode = treeWalker.nextNode()) !== null;
      nodeIndex++
    ) {
      let alternateNode: ChildNode | null = null;
      let skip = false;

      for (; holeIndex < holesLength; holeIndex++) {
        const hole = holes[holeIndex]!;
        if (hole.index !== nodeIndex) {
          break;
        }

        let childPart: Part;

        switch (hole.type) {
          case PartType.Attribute: {
            childPart = {
              type: PartType.Attribute,
              node: hydrationTree.peekNode(
                Node.ELEMENT_NODE,
                currentNode.nodeName,
              ),
              name: hole.name,
            };
            break;
          }
          case PartType.ChildNode:
            childPart = {
              type: PartType.ChildNode,
              node: document.createComment(''),
              childNode: null,
            };
            alternateNode = childPart.node;
            break;
          case PartType.Element:
            childPart = {
              type: PartType.Element,
              node: hydrationTree.peekNode(
                Node.ELEMENT_NODE,
                currentNode.nodeName,
              ),
            };
            break;
          case PartType.Event:
            childPart = {
              type: PartType.Event,
              node: hydrationTree.peekNode(
                Node.ELEMENT_NODE,
                currentNode.nodeName,
              ),
              name: hole.name,
            };
            break;
          case PartType.Live: {
            const node = hydrationTree.peekNode(
              Node.ELEMENT_NODE,
              currentNode.nodeName,
            );
            childPart = {
              type: PartType.Live,
              node,
              name: hole.name,
              defaultValue: node[hole.name as keyof Element],
            };
            break;
          }
          case PartType.Property: {
            const node = hydrationTree.peekNode(
              Node.ELEMENT_NODE,
              currentNode.nodeName,
            );
            childPart = {
              type: PartType.Property,
              node,
              name: hole.name,
              defaultValue: node[hole.name as keyof Element],
            };
            break;
          }
          case PartType.Text: {
            let node: Text;
            if (hole.split) {
              node = hydrationTree.splitText();
              skip = true;
            } else {
              node = hydrationTree.peekNode(
                Node.TEXT_NODE,
                currentNode.nodeName,
              );
            }
            childPart = {
              type: PartType.Text,
              node,
              precedingText: hole.precedingText,
              followingText: hole.followingText,
            };
            break;
          }
        }

        const slot = context.resolveSlot(binds[holeIndex]!, childPart);
        slots[holeIndex] = slot;
        slot.hydrate(hydrationTree, context);
      }

      if (!skip) {
        const consumedNode = hydrationTree.popNode(
          currentNode.nodeType,
          currentNode.nodeName,
        );

        if (alternateNode !== null) {
          consumedNode.replaceWith(alternateNode);
        }

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
  ): TemplateResult {
    const holes = this._holes;

    assertNumberOfBinds(holes.length, binds.length);

    const document = part.node.ownerDocument;
    const fragment = document.importNode(this._template.content, true);
    const slots: Slot<unknown>[] = new Array(holes.length);

    if (holes.length > 0) {
      const treeWalker = document.createTreeWalker(
        fragment,
        NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT |
          NodeFilter.SHOW_COMMENT,
      );

      for (
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
              'There is no node that the hole indicates. This may be a bug or the template may have been modified.',
            );
          }
          nodeIndex++;
        }

        let childPart: Part;

        switch (currentHole.type) {
          case PartType.Attribute:
            childPart = {
              type: PartType.Attribute,
              node: currentNode as Element,
              name: currentHole.name,
            };
            break;
          case PartType.ChildNode:
            childPart = {
              type: PartType.ChildNode,
              node: currentNode as Comment,
              childNode: null,
            };
            break;
          case PartType.Element:
            childPart = {
              type: PartType.Element,
              node: currentNode as Element,
            };
            break;
          case PartType.Event:
            childPart = {
              type: PartType.Event,
              node: currentNode as Element,
              name: currentHole.name,
            };
            break;
          case PartType.Live:
            childPart = {
              type: PartType.Live,
              node: currentNode as Element,
              name: currentHole.name,
              defaultValue: currentNode[currentHole.name as keyof Node],
            };
            break;
          case PartType.Property:
            childPart = {
              type: PartType.Property,
              node: currentNode as Element,
              name: currentHole.name,
              defaultValue: currentNode[currentHole.name as keyof Node],
            };
            break;
          case PartType.Text:
            childPart = {
              type: PartType.Text,
              node: currentNode as Text,
              precedingText: currentHole.precedingText,
              followingText: currentHole.followingText,
            };
            break;
        }

        const slot = context.resolveSlot(binds[holeIndex]!, childPart);
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
      } else if (caseSensitiveName[0] === '.' && caseSensitiveName.length > 1) {
        hole = {
          type: PartType.Property,
          index,
          name: caseSensitiveName.slice(1),
        };
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
  const document = rootNode.ownerDocument!;
  const treeWalker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
  const holes: Hole[] = [];
  let nextNode: ChildNode | null = treeWalker.nextNode() as ChildNode | null;
  let index = 0;

  while (nextNode !== null) {
    const currentNode = nextNode;
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
            type: PartType.ChildNode,
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
        if (
          (currentNode.previousSibling !== null ||
            currentNode.nextSibling !== null) &&
          ONLY_SPACES_REGEXP.test((currentNode as Text).data)
        ) {
          nextNode = treeWalker.nextNode() as ChildNode | null;
          currentNode.remove();
          continue;
        }

        const components = (currentNode as Text).data.split(marker);

        if (components.length > 1) {
          const tail = components.length - 1;
          let lastComponent = components[0]!;

          for (let i = 1; i < tail; i++) {
            holes.push({
              type: PartType.Text,
              index,
              precedingText: lastComponent,
              followingText: '',
              split: true,
            });
            currentNode.before(document.createTextNode(''));
            lastComponent = components[i]!;
            index++;
          }

          holes.push({
            type: PartType.Text,
            index,
            precedingText: lastComponent,
            followingText: components[tail]!,
            split: false,
          });
          (currentNode as Text).data = '';
        }

        break;
      }
    }

    nextNode = treeWalker.nextNode() as ChildNode | null;
    index++;
  }

  assertNumberOfHoles(binds.length, holes.length, strings);

  return holes;
}

function trimTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}
