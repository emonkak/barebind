import type { Session, TemplateMode } from '../core.js';
import { emphasizeNode, formatPart } from '../debug/dom.js';
import {
  createAttributePart,
  createChildNodePart,
  createElementPart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  createTextPart,
  createTreeWalker,
  DOM_PART_TYPE_ATTRIBUTE,
  DOM_PART_TYPE_CHILD_NODE,
  DOM_PART_TYPE_ELEMENT,
  DOM_PART_TYPE_EVENT,
  DOM_PART_TYPE_LIVE,
  DOM_PART_TYPE_PROPERTY,
  DOM_PART_TYPE_TEXT,
  type DOMHole,
  type DOMPart,
  getNamespaceURIByTagName,
  nextNode,
  replaceSentinelNode,
} from '../dom.js';
import { Slot } from '../slot.js';
import { Template, type TemplateResult } from './template.js';

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

const LEADING_NEWLINE_PATTERN = /^\s*\n/;
const TRAILING_NEWLINE_PATTERN = /\n\s*$/;

export class TaggedTemplate<
  TExprs extends readonly unknown[] = unknown[],
> extends Template<TExprs> {
  private readonly _template: HTMLTemplateElement;

  private readonly _holes: DOMHole[];

  private readonly _mode: TemplateMode;

  static parse<TExprs extends readonly unknown[]>(
    strings: readonly string[],
    exprs: TExprs,
    mode: TemplateMode,
    placeholder: string,
    document: Document,
  ): TaggedTemplate<TExprs> {
    const template = document.createElement('template');
    const marker = createMarker(placeholder);
    const htmlString = stripWhitespaces(strings.join(marker));

    if (mode === 'html') {
      template.setHTMLUnsafe(htmlString);
    } else {
      template.setHTMLUnsafe(`<${mode}>${htmlString}</${mode}>`);
      template.content.replaceChildren(
        ...template.content.firstChild!.childNodes,
      );
    }

    const holes = parseChildren(strings, exprs, marker, template.content);

    return new TaggedTemplate(template, holes, mode);
  }

  constructor(
    template: HTMLTemplateElement,
    holes: DOMHole[],
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
    exprs: TExprs,
    part: DOMPart.ChildNodePart,
    hydrationTarget: TreeWalker,
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const { ownerDocument } = part.sentinelNode;
    const fragment = this._template.content;
    const hydrationTemplate = createTreeWalker(fragment);
    const holes = this._holes;
    const totalHoles = holes.length;
    const childNodes: ChildNode[] = [];
    const slots: Slot<unknown, DOMPart>[] = new Array(totalHoles);
    let nodeIndex = 0;
    let holeIndex = 0;

    for (
      let templateNode: Node | null;
      (templateNode = hydrationTemplate.nextNode()) !== null;
      nodeIndex++
    ) {
      const hydratedNodes: ChildNode[] = [];

      for (; holeIndex < totalHoles; holeIndex++) {
        const hole = holes[holeIndex]!;
        let part: DOMPart;

        if (hole.index !== nodeIndex) {
          break;
        }

        if (hole.type === DOM_PART_TYPE_TEXT) {
          part = hydrateTextPart(
            hydrationTarget,
            hole,
            hydratedNodes.length > 0,
          );
          hydratedNodes.push(part.node);
        } else if (hole.type === DOM_PART_TYPE_CHILD_NODE) {
          part = createChildNodePart(
            ownerDocument.createComment(''),
            getNamespaceURI(hydrationTarget.currentNode, this._mode),
          );
          hydratedNodes.push(part.node);
        } else {
          let currentNode: Element;
          if (hydratedNodes.length > 0) {
            currentNode = hydrationTarget.currentNode as Element;
          } else {
            currentNode = nextNode(
              templateNode.nodeName,
              hydrationTarget,
            ) as Element;
            hydratedNodes.push(currentNode);
          }
          switch (hole.type) {
            case DOM_PART_TYPE_ATTRIBUTE:
              part = createAttributePart(currentNode, hole.name);
              break;
            case DOM_PART_TYPE_EVENT:
              part = createEventPart(currentNode, hole.name);
              break;
            case DOM_PART_TYPE_ELEMENT:
              part = createElementPart(currentNode);
              break;
            case DOM_PART_TYPE_LIVE:
              part = createLivePart(currentNode, hole.name);
              break;
            case DOM_PART_TYPE_PROPERTY:
              part = createPropertyPart(currentNode, hole.name);
              break;
          }
        }

        const slot = Slot.place(exprs[holeIndex]!, part, context);
        slot.attach(session);

        if (part.type === DOM_PART_TYPE_CHILD_NODE) {
          replaceSentinelNode(hydrationTarget, part.sentinelNode);
        }

        slots[holeIndex] = slot;
      }

      if (hydratedNodes.length === 0) {
        hydratedNodes.push(
          nextNode(templateNode.nodeName, hydrationTarget) as ChildNode,
        );
      }

      if (templateNode.parentNode === fragment) {
        childNodes.push(...hydratedNodes);
      }
    }

    if (holeIndex < totalHoles) {
      throw new Error(
        'There is no node that the hole indicates. The template may have been modified.',
      );
    }

    return { childNodes, slots };
  }

  render(
    exprs: TExprs,
    part: DOMPart.ChildNodePart,
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const { ownerDocument } = part.sentinelNode;
    const fragment = ownerDocument.importNode(this._template.content, true);
    const holes = this._holes;
    const slots: Slot<unknown, DOMPart>[] = new Array(holes.length);

    if (holes.length > 0) {
      const renderTarget = createTreeWalker(fragment);
      let nodeIndex = 0;

      for (let i = 0, l = holes.length; i < l; i++) {
        const hole = holes[i]!;

        for (; nodeIndex <= hole.index; nodeIndex++) {
          if (renderTarget.nextNode() === null) {
            throw new Error(
              'There is no node that the hole indicates. The template may have been modified.',
            );
          }
        }

        const currentNode = renderTarget.currentNode;
        let currentPart: DOMPart;

        switch (hole.type) {
          case DOM_PART_TYPE_ATTRIBUTE:
            currentPart = createAttributePart(
              currentNode as Element,
              hole.name,
            );
            break;
          case DOM_PART_TYPE_EVENT:
            currentPart = createEventPart(currentNode as Element, hole.name);
            break;
          case DOM_PART_TYPE_CHILD_NODE:
            currentPart = createChildNodePart(
              currentNode as Comment,
              getNamespaceURI(currentNode, this._mode),
            );
            break;
          case DOM_PART_TYPE_ELEMENT:
            currentPart = createElementPart(currentNode as Element);
            break;
          case DOM_PART_TYPE_LIVE:
            currentPart = createLivePart(currentNode as Element, hole.name);
            break;
          case DOM_PART_TYPE_PROPERTY:
            currentPart = createPropertyPart(currentNode as Element, hole.name);
            break;
          case DOM_PART_TYPE_TEXT:
            currentPart = splitTextPart(renderTarget, hole);
            break;
        }

        const slot = Slot.place(exprs[i]!, currentPart, context);
        slot.attach(session);

        slots[i] = slot;
      }
    }

    const childNodes = Array.from(fragment.childNodes);

    return { childNodes, slots };
  }
}

function createMarker(placeholder: string): string {
  // Marker requirements:
  // - Makers start with "?" to detect when it is used as a tag name. In
  //   that case, the tag is treated as a comment.
  //   https://html.spec.whatwg.org/multipage/parsing.html#parse-error-unexpected-question-mark-instead-of-tag-name
  // - Makers are all lowercase to match attribute names.
  if (!PLACEHOLDER_PATTERN.test(placeholder)) {
    throw new Error(
      `Placeholders must match pattern ${PLACEHOLDER_PATTERN}, but got ${JSON.stringify(placeholder)}.`,
    );
  }
  return '??' + placeholder + '??';
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
  holes: DOMHole[],
  index: number,
): void {
  const names = element.getAttributeNames();

  for (const name of names) {
    const value = element.getAttribute(name)!;
    let hole: DOMHole;

    if (name === marker && value === '') {
      hole = {
        type: DOM_PART_TYPE_ELEMENT,
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
                { type: DOM_PART_TYPE_ATTRIBUTE, name, node: element },
                ERROR_MAKER,
              ),
          );
        }
      }

      switch (caseSensitiveName[0]) {
        case '@':
          hole = {
            type: DOM_PART_TYPE_EVENT,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '$':
          hole = {
            type: DOM_PART_TYPE_LIVE,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        case '.':
          hole = {
            type: DOM_PART_TYPE_PROPERTY,
            index,
            name: caseSensitiveName.slice(1),
          };
          break;
        default:
          hole = {
            type: DOM_PART_TYPE_ATTRIBUTE,
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
                  type: DOM_PART_TYPE_ATTRIBUTE,
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
                  type: DOM_PART_TYPE_ATTRIBUTE,
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
  exprs: readonly unknown[],
  marker: string,
  fragment: DocumentFragment,
): DOMHole[] {
  const sourceTree = createTreeWalker(fragment);
  const holes: DOMHole[] = [];
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
                  { type: DOM_PART_TYPE_ELEMENT, node: currentNode as Element },
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
            type: DOM_PART_TYPE_CHILD_NODE,
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
        const components = (currentNode as Text).data
          .split(marker)
          .map(stripWhitespaces);
        let lastComponent = components[0]!;
        let normalizedText = lastComponent;

        if (components.length > 1) {
          const tail = components.length - 1;

          for (let i = 1; i < tail; i++) {
            const component = components[i]!;
            holes.push({
              type: DOM_PART_TYPE_TEXT,
              index,
              leadingSpan: lastComponent.length,
              trailingSpan: 0,
            });
            lastComponent = component;
            normalizedText += component;
          }

          const component = components[tail];
          holes.push({
            type: DOM_PART_TYPE_TEXT,
            index,
            leadingSpan: lastComponent.length,
            trailingSpan: component!.length,
          });
          normalizedText += component;
        }

        if (normalizedText === '' && components.length === 1) {
          nextNode = sourceTree.nextNode() as ChildNode | null;
          currentNode.remove();
          continue;
        }

        (currentNode as Text).data = normalizedText;

        break;
      }
    }

    nextNode = sourceTree.nextNode() as ChildNode | null;
    index++;
  }

  if (exprs.length !== holes.length) {
    throw new Error(
      `The number of holes must be ${exprs.length}, but got ${holes.length}. There may be multiple holes indicating the same attribute:\n` +
        // biome-ignore lint/suspicious/noTemplateCurlyInString: "${...}" represents a template literal hole
        strings.join('${...}').trim(),
    );
  }

  return holes;
}

function splitTextPart(
  treeWalker: TreeWalker,
  hole: DOMHole.TextHole,
): DOMPart.TextPart {
  let currentNode = treeWalker.currentNode as Text;
  if (currentNode.previousSibling?.nodeType === Node.TEXT_NODE) {
    currentNode = currentNode.splitText(0);
  }
  if (hole.leadingSpan > 0) {
    currentNode = currentNode.splitText(hole.leadingSpan);
  }
  const part = createTextPart(currentNode);
  currentNode = hole.trailingSpan > 0 ? currentNode.splitText(0) : part.node;
  treeWalker.currentNode = currentNode;
  return part;
}

function hydrateTextPart(
  treeWalker: TreeWalker,
  hole: DOMHole.TextHole,
  contiguous: boolean,
): DOMPart.TextPart {
  let currentNode = treeWalker.currentNode;
  if (contiguous) {
    currentNode = nextNode('#comment', treeWalker);
  }
  if (hole.leadingSpan > 0) {
    nextNode('#text', treeWalker);
    currentNode = nextNode('#comment', treeWalker);
  }
  const part = createTextPart(nextNode('#text', treeWalker));
  if (hole.trailingSpan > 0) {
    nextNode('#comment', treeWalker);
    currentNode = nextNode('#text', treeWalker);
  } else {
    currentNode = part.node;
  }
  treeWalker.currentNode = currentNode;
  return part;
}

function stripTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}

function stripWhitespaces(text: string): string {
  if (LEADING_NEWLINE_PATTERN.test(text)) {
    text = text.trimStart();
  }
  if (TRAILING_NEWLINE_PATTERN.test(text)) {
    text = text.trimEnd();
  }
  return text;
}
