import {
  type DirectiveHandler,
  type Scope,
  type Session,
  type Template,
  type TemplateMode,
  wrap,
} from '../core.js';
import type { Slot } from '../slot.js';
import {
  AttributeType,
  ChildNodeType,
  type DOMPart,
  ElementType,
  EventType,
  LiveType,
  PropertyType,
  TextType,
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

export type DOMHole =
  | DOMHole.AttributeHole
  | DOMHole.ChildNodeHole
  | DOMHole.ElementHole
  | DOMHole.EventHole
  | DOMHole.LiveHole
  | DOMHole.PropertyHole
  | DOMHole.TextHole;

export namespace DOMHole {
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

export interface DOMTemplateRenderer {
  renderTemplate(
    template: DOMTemplate,
    exprs: readonly unknown[],
    scope: Scope<DOMPart, DOMTemplateRenderer>,
  ): DOMTemplateResult;
}

export interface DOMTemplateResult {
  childNodes: ChildNode[];
  slots: Slot<DOMPart, DOMTemplateRenderer>[];
}

export class DOMTemplate {
  readonly element: HTMLTemplateElement;
  readonly holes: DOMHole[];
  readonly mode: TemplateMode;

  static parse(
    strings: readonly string[],
    exprs: readonly unknown[],
    mode: TemplateMode,
    placeholder: string,
  ) {
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
  }
}

export class DOMTemplateHandler
  implements DirectiveHandler<Template, DOMPart, DOMTemplateRenderer>
{
  private readonly _template: DOMTemplate;
  private _childNodes: ChildNode[] = [];
  private _slots: Slot<DOMPart>[] = [];

  constructor(template: DOMTemplate) {
    this._template = template;
  }

  shouldUpdate(newTemplate: Template, oldTemplate: Template): boolean {
    return newTemplate.exprs !== oldTemplate.exprs;
  }

  render(
    template: Template,
    _part: DOMPart.ChildNodePart,
    scope: Scope.ChildScope<DOMPart.ChildNodePart, DOMTemplateRenderer>,
    session: Session<DOMPart.ChildNodePart, DOMTemplateRenderer>,
  ): Iterable<Slot> {
    if (
      this._childNodes.length === 0 &&
      this._template.element.content.firstChild !== null
    ) {
      const { childNodes, slots } = session.renderer.renderTemplate(
        this._template,
        template.exprs,
        scope,
      );
      this._childNodes = childNodes;
      this._slots = slots;
    } else {
      this._slots = this._slots.map((slot, i) =>
        slot.update(wrap(template.exprs[i]), scope),
      );
    }
    return this._slots;
  }

  discard(
    _template: Template,
    _part: DOMPart.ChildNodePart,
    _scope: Scope<DOMPart.ChildNodePart, DOMTemplateRenderer>,
    session: Session<DOMPart.ChildNodePart, DOMTemplateRenderer>,
  ): void {
    for (const slot of this._slots) {
      slot.discard(session);
    }
  }

  complete(
    _template: Template,
    _part: DOMPart.ChildNodePart,
    _scope: Scope<DOMPart.ChildNodePart, DOMTemplateRenderer>,
    _session: Session<DOMPart.ChildNodePart, DOMTemplateRenderer>,
  ): void {}

  commit(
    _newTemplate: Template,
    _oldTemplate: Template | null,
    part: DOMPart.ChildNodePart,
  ): void {
    if (part.node === part.sentinelNode) {
      part.sentinelNode.before(...this._childNodes);
    }

    for (const slot of this._slots) {
      slot.commit();
    }

    part.node =
      getStartNode(this._childNodes, this._slots) ?? part.sentinelNode;
  }

  revert(_template: Template, part: DOMPart.ChildNodePart): void {
    for (const slot of this._slots) {
      if (
        (slot.part.type === ChildNodeType || slot.part.type === TextType) &&
        this._childNodes.includes(getEndNode(slot.part))
      ) {
        // This slot is mounted as a child of the root, so we must revert it.
        slot.revert();
      }
    }

    part.node = part.sentinelNode;
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
  if (!PLACEHOLDER_PATTERN.test(placeholder)) {
    throw new Error(
      `Placeholders must match pattern ${PLACEHOLDER_PATTERN}, but got "${placeholder}".`,
    );
  }
  return '??' + placeholder + '??';
}

function extractRawAttributeName(span: string): string | undefined {
  return span.match(ATTRIBUTE_NAME_PATTERN)?.[0];
}

function getEndNode(part: DOMPart): ChildNode {
  return part.type === ChildNodeType ? part.sentinelNode : part.node;
}

function getStartNode(
  childNodes: readonly ChildNode[],
  slots: readonly Slot<DOMPart>[],
): ChildNode | null {
  const childNode = childNodes[0];
  const slot = slots[0];
  return childNode !== undefined &&
    slot !== undefined &&
    childNode === getEndNode(slot.part)
    ? slot.part.node
    : (childNode ?? null);
}

function parseAttribtues(
  element: Element,
  strings: readonly string[],
  marker: string,
  holes: DOMHole[],
  index: number,
): void {
  for (const attribute of Array.from(element.attributes)) {
    let hole: DOMHole;

    if (attribute.name === marker && attribute.value === '') {
      hole = {
        type: ElementType,
        index,
      };
    } else if (attribute.value === marker) {
      const rawName = extractRawAttributeName(strings[holes.length]!);

      DEBUG: {
        if (rawName?.toLowerCase() !== attribute.name) {
          throw new Error(
            `The attribute name must be "${attribute.name}", but got "${rawName}". There are unclosed tags or duplicate attributes.`,
          );
        }
      }

      switch (rawName![0]) {
        case '@':
          hole = {
            type: EventType,
            index,
            name: rawName!.slice(1),
          };
          break;
        case '$':
          hole = {
            type: LiveType,
            index,
            name: rawName!.slice(1),
          };
          break;
        case '.':
          hole = {
            type: PropertyType,
            index,
            name: rawName!.slice(1),
          };
          break;
        default:
          hole = {
            type: AttributeType,
            index,
            name: rawName!,
          };
          break;
      }
    } else {
      DEBUG: {
        if (attribute.name.includes(marker)) {
          throw new Error('Expressions are not allowed as an attribute name.');
        }

        if (attribute.value.includes(marker)) {
          throw new Error(
            'Expressions inside an attribute must make up the entire attribute value.',
          );
        }
      }
      continue;
    }

    holes.push(hole);
    element.removeAttribute(attribute.name);
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
  let nextNode = sourceTree.nextNode();
  let index = 0;

  while (nextNode !== null) {
    const currentNode = nextNode;
    switch (currentNode.nodeType) {
      case Node.ELEMENT_NODE: {
        DEBUG: {
          if ((currentNode as Element).localName.includes(marker)) {
            throw new Error('Expressions are not allowed as a tag name.');
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
            type: ChildNodeType,
            index,
          });
          (currentNode as Comment).data = '';
        } else {
          DEBUG: {
            if ((currentNode as Comment).data.includes(marker)) {
              throw new Error(
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
        let lastComponent = components[0]!;
        let normalizedText = lastComponent;

        if (components.length > 1) {
          const tail = components.length - 1;

          for (let i = 1; i < tail; i++) {
            const component = components[i]!;
            holes.push({
              type: TextType,
              index,
              leadingSpan: lastComponent.length,
              trailingSpan: 0,
            });
            lastComponent = component;
            normalizedText += component;
          }

          const component = components[tail]!;
          holes.push({
            type: TextType,
            index,
            leadingSpan: lastComponent.length,
            trailingSpan: component.length,
          });
          normalizedText += component;
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
