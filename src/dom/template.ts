import type {
  Binding,
  DirectiveContext,
  DirectiveType,
  Effect,
  Session,
  TemplateMode,
} from '../core.js';
import { Slot } from '../slot.js';
import { emphasizeNode, formatPart } from './debug.js';
import { ensurePartType, HydrationError } from './error.js';
import {
  createAttributePart,
  createChildNodePart,
  createElementPart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  createTextPart,
  type DOMPart,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
} from './part.js';

const PLACEHOLDER_PATTERN = /^[0-9a-z_-]+$/;

const LEADING_NEWLINE_PATTERN = /^\s*\n/;
const TRAILING_NEWLINE_PATTERN = /\n\s*$/;

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

const NAMESPACE_URI_MAP: Record<TemplateMode, string | null> = {
  html: 'http://www.w3.org/1999/xhtml',
  math: 'http://www.w3.org/1998/Math/MathML',
  svg: 'http://www.w3.org/2000/svg',
  textarea: null,
};

export type DOMHole =
  | DOMHole.Attribute
  | DOMHole.ChildNode
  | DOMHole.Element
  | DOMHole.Event
  | DOMHole.Live
  | DOMHole.Property
  | DOMHole.Text;

export namespace DOMHole {
  export interface Attribute {
    type: typeof PART_TYPE_ATTRIBUTE;
    index: number;
    name: string;
  }

  export interface ChildNode {
    type: typeof PART_TYPE_CHILD_NODE;
    index: number;
  }

  export interface Element {
    type: typeof PART_TYPE_ELEMENT;
    index: number;
  }

  export interface Event {
    type: typeof PART_TYPE_EVENT;
    index: number;
    name: string;
  }

  export interface Live {
    type: typeof PART_TYPE_LIVE;
    index: number;
    name: string;
  }

  export interface Property {
    type: typeof PART_TYPE_PROPERTY;
    index: number;
    name: string;
  }

  export interface Text {
    type: typeof PART_TYPE_TEXT;
    index: number;
    leadingSpan: number;
    trailingSpan: number;
  }
}

export interface DOMRenderer {
  readonly container: Element;
  renderChildNodePart(namespaceURI: string | null): DOMPart.ChildNode;
  renderTemplate(
    template: DOMTemplate,
    exprs: readonly unknown[],
    session: Session<DOMPart, DOMRenderer>,
  ): DOMTemplateResult;
}

export interface DOMTemplateResult {
  childNodes: readonly ChildNode[];
  slots: readonly Slot<unknown, DOMPart, DOMRenderer>[];
}

export class DOMTemplate<TExprs extends readonly unknown[] = readonly unknown[]>
  implements DirectiveType<TExprs, DOMPart.ChildNode, DOMRenderer>
{
  readonly element: HTMLTemplateElement;

  readonly holes: DOMHole[];

  readonly mode: TemplateMode;

  static parse<TExprs extends readonly unknown[]>(
    strings: readonly string[],
    exprs: TExprs,
    mode: TemplateMode,
    placeholder: string,
    document: Document,
  ): DOMTemplate<TExprs> {
    const element = document.createElement('template');
    const marker = createMarker(placeholder);
    const htmlString = stripWhitespaces(strings.join(marker));

    if (mode === 'html') {
      element.setHTMLUnsafe(htmlString);
    } else {
      element.setHTMLUnsafe(`<${mode}>${htmlString}</${mode}>`);
      element.content.replaceChildren(
        ...element.content.firstChild!.childNodes,
      );
    }

    const holes = parseChildren(strings, exprs, marker, element.content);

    return new DOMTemplate(element, holes, mode);
  }

  constructor(
    element: HTMLTemplateElement,
    holes: DOMHole[],
    mode: TemplateMode,
  ) {
    this.element = element;
    this.holes = holes;
    this.mode = mode;
    DEBUG: {
      Object.freeze(this);
    }
  }

  get name(): string {
    return DOMTemplate.name;
  }

  resolveBinding(
    exprs: TExprs,
    part: DOMPart.ChildNode,
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMTemplateBinding<TExprs> {
    ensurePartType(PART_TYPE_CHILD_NODE, this, exprs, part);
    return new DOMTemplateBinding(this, exprs, part);
  }
}

export class DOMTemplateBinding<TExprs extends readonly unknown[]>
  implements Binding<TExprs, DOMPart.ChildNode>, Effect
{
  private readonly _template: DOMTemplate<TExprs>;

  private _pendingExprs: TExprs;

  private _currentExprs: TExprs | null = null;

  private readonly _part: DOMPart.ChildNode;

  private _memoizedResult: DOMTemplateResult | null = null;

  constructor(
    template: DOMTemplate<TExprs>,
    exprs: TExprs,
    part: DOMPart.ChildNode,
  ) {
    this._template = template;
    this._pendingExprs = exprs;
    this._part = part;
  }

  get type(): DOMTemplate<TExprs> {
    return this._template;
  }

  get value(): TExprs {
    return this._pendingExprs;
  }

  set value(newExprs: TExprs) {
    this._pendingExprs = newExprs;
  }

  get part(): DOMPart.ChildNode {
    return this._part;
  }

  shouldUpdate(newExprs: readonly unknown[]): boolean {
    return this._currentExprs === null || newExprs !== this._currentExprs;
  }

  attach(session: Session<DOMPart, DOMRenderer>): void {
    if (this._memoizedResult !== null) {
      const { slots } = this._memoizedResult;
      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.update(this._pendingExprs[i]!, session);
      }
    } else {
      this._memoizedResult = session.renderer.renderTemplate(
        this._template,
        this._pendingExprs,
        session,
      );
    }
  }

  detach(session: Session<DOMPart, DOMRenderer>): void {
    if (this._memoizedResult !== null) {
      const { slots } = this._memoizedResult;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.detach(session);
      }
    }
  }

  commit(): void {
    if (this._memoizedResult !== null) {
      const { childNodes, slots } = this._memoizedResult;

      if (this._currentExprs === null) {
        this._part.sentinelNode.before(...childNodes);
      }

      for (const slot of slots) {
        slot.commit();
      }

      this._currentExprs = this._pendingExprs;
      this._part.node =
        getStartNode(childNodes, slots) ?? this._part.sentinelNode;
    }
  }

  rollback(): void {
    if (this._memoizedResult !== null) {
      const { childNodes, slots } = this._memoizedResult;

      for (const slot of slots) {
        if (
          (slot.part.type === PART_TYPE_CHILD_NODE ||
            slot.part.type === PART_TYPE_TEXT) &&
          childNodes.includes(getEndNode(slot.part))
        ) {
          // This binding is mounted as a child of the root, so we must rollback it.
          slot.rollback();
        }
      }

      for (const child of childNodes) {
        child.remove();
      }

      this._currentExprs = null;
      this._part.node = this._part.sentinelNode;
    }
  }
}

export class ClientRenderer implements DOMRenderer {
  private readonly _container: Element;

  constructor(container: Element) {
    this._container = container;
  }

  get container(): Element {
    return this._container;
  }

  renderTemplate(
    template: DOMTemplate,
    exprs: readonly unknown[],
    session: Session<DOMPart, DOMRenderer>,
  ): DOMTemplateResult {
    const { context } = session;
    const fragment = this._container.ownerDocument.importNode(
      template.element.content,
      true,
    );
    const holes = template.holes;
    const slots: Slot<unknown, DOMPart, DOMRenderer>[] = new Array(
      holes.length,
    );

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
          case PART_TYPE_ATTRIBUTE:
            currentPart = createAttributePart(
              currentNode as Element,
              hole.name,
            );
            break;
          case PART_TYPE_EVENT:
            currentPart = createEventPart(currentNode as Element, hole.name);
            break;
          case PART_TYPE_CHILD_NODE:
            currentPart = createChildNodePart(
              currentNode as Comment,
              getNamespaceURI(currentNode, template.mode),
            );
            break;
          case PART_TYPE_ELEMENT:
            currentPart = createElementPart(currentNode as Element);
            break;
          case PART_TYPE_LIVE:
            currentPart = createLivePart(currentNode as Element, hole.name);
            break;
          case PART_TYPE_PROPERTY:
            currentPart = createPropertyPart(currentNode as Element, hole.name);
            break;
          case PART_TYPE_TEXT:
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

  renderChildNodePart(namespaceURI: string | null): DOMPart.ChildNode {
    return createChildNodePart(
      this._container.ownerDocument.createComment(''),
      namespaceURI ?? this._container.namespaceURI,
    );
  }
}

export class HydrationRenderer implements DOMRenderer {
  private readonly _target: TreeWalker;

  constructor(container: Element) {
    this._target = createTreeWalker(container);
  }

  get container(): Element {
    return this._target.root as Element;
  }

  renderTemplate(
    template: DOMTemplate,
    exprs: readonly unknown[],
    session: Session<DOMPart, DOMRenderer>,
  ): DOMTemplateResult {
    const { context } = session;
    const fragment = template.element.content;
    const hydrationTemplate = createTreeWalker(fragment);
    const holes = template.holes;
    const totalHoles = holes.length;
    const childNodes: ChildNode[] = [];
    const slots: Slot<unknown, DOMPart, DOMRenderer>[] = new Array(totalHoles);
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
        let currentPart: DOMPart;

        if (hole.index !== nodeIndex) {
          break;
        }

        if (hole.type === PART_TYPE_TEXT) {
          currentPart = hydrateTextPart(this._target, hole, hydratedNodes);
        } else if (hole.type === PART_TYPE_CHILD_NODE) {
          currentPart = createChildNodePart(
            popNode('#comment', this._target),
            getNamespaceURI(this._target.currentNode, template.mode),
          );
          hydratedNodes.push(currentPart.node);
        } else {
          if (hydratedNodes.length === 0) {
            hydratedNodes.push(
              popNode(templateNode.nodeName, this._target) as Element,
            );
          }
          const currentNode = this._target.currentNode as Element;
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

        const slot = Slot.place(exprs[holeIndex]!, currentPart, context);
        slot.attach(session);

        slots[holeIndex] = slot;
      }

      if (hydratedNodes.length === 0) {
        hydratedNodes.push(
          popNode(templateNode.nodeName, this._target) as ChildNode,
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

  renderChildNodePart(namespaceURI: string | null): DOMPart.ChildNode {
    return createChildNodePart(
      popNode('#comment', this._target),
      namespaceURI ?? (this._target.root as Element).namespaceURI,
    );
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

function createTreeWalker(container: DocumentFragment | Element): TreeWalker {
  return container.ownerDocument.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
}

function extractCaseSensitiveAttributeName(s: string): string | undefined {
  return s.match(ATTRIBUTE_NAME_PATTERN)?.[0];
}

function getEndNode(part: DOMPart): ChildNode {
  return part.type === PART_TYPE_CHILD_NODE ? part.sentinelNode : part.node;
}

function getNamespaceURI(node: Node, mode: TemplateMode): string | null {
  return node.lookupNamespaceURI(null) ?? NAMESPACE_URI_MAP[mode] ?? null;
}

function getStartNode(
  childNodes: readonly ChildNode[],
  slots: readonly Slot<unknown, DOMPart, DOMRenderer>[],
): ChildNode | null {
  const childNode = childNodes[0];
  const slot = slots[0];
  return childNode !== undefined &&
    slot !== undefined &&
    childNode === getEndNode(slot.part)
    ? slot.part.node
    : (childNode ?? null);
}

function hydrateTextPart(
  treeWalker: TreeWalker,
  hole: DOMHole.Text,
  hydratedNodes: ChildNode[],
): DOMPart.Text {
  if (hydratedNodes.length > 0) {
    popNode('#comment', treeWalker);
  }
  if (hole.leadingSpan > 0) {
    hydratedNodes.push(popNode('#text', treeWalker));
    popNode('#comment', treeWalker);
  }
  const part = createTextPart(popNode('#text', treeWalker));
  hydratedNodes.push(part.node);
  if (hole.trailingSpan > 0) {
    popNode('#comment', treeWalker);
    hydratedNodes.push(popNode('#text', treeWalker));
  } else {
    treeWalker.currentNode = part.node;
  }
  return part;
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
            `The attribute name must be "${name}", but got "${caseSensitiveName}". There are unclosed tags or duplicate attributes':\n` +
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
              type: PART_TYPE_TEXT,
              index,
              leadingSpan: lastComponent.length,
              trailingSpan: 0,
            });
            lastComponent = component;
            normalizedText += component;
          }

          const component = components[tail];
          holes.push({
            type: PART_TYPE_TEXT,
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
      `The number of holes must be ${exprs.length}, but got ${holes.length}. Multiple holes indicate the same attribute:\n` +
        // biome-ignore lint/suspicious/noTemplateCurlyInString: "${...}" represents a template literal hole
        strings.join('${...}').trim(),
    );
  }

  return holes;
}

function popNode(expectedName: '#comment', treeWalker: TreeWalker): Comment;
function popNode(expectedName: '#text', treeWalker: TreeWalker): Text;
function popNode(expectedName: string, treeWalker: TreeWalker): Node;
function popNode(expectedName: string, treeWalker: TreeWalker): Node {
  const node = treeWalker.nextNode();

  if (node === null || node.nodeName !== expectedName) {
    throw new HydrationError(
      treeWalker.currentNode,
      `Hydration failed because the node name mismatches. ${expectedName} is expected here, but got ${node?.nodeName}.`,
    );
  }

  return node;
}

function splitTextPart(
  treeWalker: TreeWalker,
  hole: DOMHole.Text,
): DOMPart.Text {
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
