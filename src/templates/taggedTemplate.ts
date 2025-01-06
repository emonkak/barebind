import {
  type Binding,
  type ChildNodePart,
  type DirectiveContext,
  type Part,
  PartType,
  type Template,
  type TemplateMode,
  type TemplateView,
  type UpdateContext,
  resolveBinding,
} from '../baseTypes.js';
import { nameOf, reportPart } from '../debug.js';
import { LazyTemplateResult } from '../directives/templateResult.js';

export type Hole =
  | AttributeHole
  | ChildNodeHole
  | ElementHole
  | EventHole
  | NodeHole
  | PropertyHole;

export interface AttributeHole {
  type: PartType.Attribute;
  index: number;
  name: string;
}

export interface ChildNodeHole {
  type: PartType.ChildNode;
  index: number;
}

export interface ElementHole {
  type: PartType.Element;
  index: number;
}

export interface EventHole {
  type: PartType.Event;
  index: number;
  name: string;
}

export interface NodeHole {
  type: PartType.Node;
  index: number;
}

export interface PropertyHole {
  type: PartType.Property;
  index: number;
  name: string;
}

// Marker Requirements:
// - A marker starts with "?" to detect when it is used as a tag name. In that
//   case, the tag is treated as a comment.
//   https://html.spec.whatwg.org/multipage/parsing.html#parse-error-unexpected-question-mark-instead-of-tag-name
// - A marker is lowercase to match attribute names.
const MARKER_REGEXP = /^\?{2}[0-9a-z_-]+\?{2}$/;

// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
const ATTRIBUTE_NAME_CHARS = String.raw`[^ "'>/=\p{Control}\p{Noncharacter_Code_Point}]`;
// https://infra.spec.whatwg.org/#ascii-whitespace
const WHITESPACE_CHARS = String.raw`[\t\n\f\r ]`;

const ATTRIBUTE_NAME_REGEXP = new RegExp(
  `(${ATTRIBUTE_NAME_CHARS}+)${WHITESPACE_CHARS}*=${WHITESPACE_CHARS}*["']?$`,
  'u',
);

const ERROR_MAKER = '[[ERROR IN HERE]]';

export class TaggedTemplate<TValues extends readonly any[]>
  implements Template<TValues>
{
  static parse<TValues extends readonly any[]>(
    strings: readonly string[],
    values: TValues,
    marker: string,
    mode: TemplateMode,
  ): TaggedTemplate<TValues> {
    DEBUG: {
      ensureValidMarker(marker);
    }
    const template = document.createElement('template');
    if (mode === 'math' || mode === 'svg') {
      template.innerHTML =
        '<' + mode + '>' + strings.join(marker).trim() + '</' + mode + '>';
      template.content.replaceChildren(
        ...template.content.firstChild!.childNodes,
      );
    } else {
      template.innerHTML = strings.join(marker).trim();
    }
    const holes =
      values.length > 0
        ? parseChildren(strings, values, marker, template.content)
        : [];
    return new TaggedTemplate(template, holes);
  }

  private readonly _element: HTMLTemplateElement;

  private readonly _holes: Hole[];

  private constructor(element: HTMLTemplateElement, holes: Hole[]) {
    this._element = element;
    this._holes = holes;
  }

  get element(): HTMLTemplateElement {
    return this._element;
  }

  get holes(): Hole[] {
    return this._holes;
  }

  render(
    values: TValues,
    context: DirectiveContext,
  ): TaggedTemplateView<TValues> {
    const holes = this._holes;

    DEBUG: {
      assertNumberOfValues(holes.length, values.length);
    }

    const bindings = new Array(holes.length);
    const fragment = document.importNode(this._element.content, true);

    if (holes.length > 0) {
      const walker = document.createTreeWalker(
        fragment,
        NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT |
          NodeFilter.SHOW_COMMENT,
      );

      let currentHole = holes[0]!;
      let currentNode: Node | null;
      let holeIndex = 0;
      let nodeIndex = 0;

      OUTER: while ((currentNode = walker.nextNode()) !== null) {
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
            case PartType.Node:
              part = {
                type: PartType.Node,
                node: currentNode as ChildNode,
              };
              break;
            case PartType.Property:
              part = {
                type: PartType.Property,
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
          }

          bindings[holeIndex] = resolveBinding(
            values[holeIndex],
            part,
            context,
          );
          holeIndex++;

          if (holeIndex >= holes.length) {
            break OUTER;
          }

          currentHole = holes[holeIndex]!;
        }

        nodeIndex++;
      }
    }

    const childNodes = [...fragment.childNodes];

    // Detach child nodes from the DocumentFragment.
    fragment.replaceChildren();

    return new TaggedTemplateView(bindings, childNodes);
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return other === this;
  }

  wrapInResult(values: TValues): LazyTemplateResult<TValues> {
    return new LazyTemplateResult(this, values);
  }
}

export class TaggedTemplateView<TValues extends readonly any[]>
  implements TemplateView<TValues>
{
  private readonly _bindings: Binding<unknown>[];

  private readonly _childNodes: ChildNode[];

  constructor(bindings: Binding<unknown>[], childNodes: ChildNode[]) {
    this._bindings = bindings;
    this._childNodes = childNodes;
  }

  get childNodes(): ChildNode[] {
    return this._childNodes;
  }

  get startNode(): ChildNode | null {
    return this._bindings.length > 0 &&
      this._childNodes[0] === this._bindings[0]!.part.node
      ? this._bindings[0]!.startNode
      : (this._childNodes[0] ?? null);
  }

  get endNode(): ChildNode | null {
    return this._childNodes.at(-1) ?? null;
  }

  get bindings(): Binding<unknown>[] {
    return this._bindings;
  }

  connect(context: UpdateContext): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.connect(context);
    }
  }

  bind(values: TValues, context: UpdateContext): void {
    DEBUG: {
      assertNumberOfValues(this._bindings.length, values.length);
    }

    for (let i = 0, l = this._bindings.length; i < l; i++) {
      const binding = this._bindings[i]!;

      DEBUG: {
        if (binding.part.type === PartType.ChildNode) {
          binding.part.node.data = nameOf(values[i]);
        }
      }

      binding.bind(values[i]!, context);
    }
  }

  unbind(context: UpdateContext): void {
    // Unbind in reverse order.
    for (let i = this._bindings.length - 1; i >= 0; i--) {
      const binding = this._bindings[i]!;
      const part = binding.part;

      if (
        (part.type === PartType.ChildNode || part.type === PartType.Node) &&
        this._childNodes.includes(part.node)
      ) {
        // This binding is mounted as a child of the root, so it must be unbound.
        binding.unbind(context);
      } else {
        // Otherwise, it does not need to be unbound.
        binding.disconnect(context);
      }
    }
  }

  disconnect(context: UpdateContext): void {
    // Disconnect in reverse order.
    for (let i = this._bindings.length - 1; i >= 0; i--) {
      this._bindings[i]!.disconnect(context);
    }
  }

  mount(part: ChildNodePart): void {
    const referenceNode = part.node;
    referenceNode.before(...this._childNodes);
  }

  unmount(_part: ChildNodePart): void {
    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }
  }
}

export function createMarker(randomString: string): string {
  return '??' + randomString + '??';
}

export function isValidMarker(marker: string): boolean {
  return MARKER_REGEXP.test(marker);
}

function ensureValidMarker(marker: string): void {
  if (!isValidMarker(marker)) {
    throw new Error(`The marker is in an invalid format: ${marker}`);
  }
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

    if (name === marker && value === '') {
      holes.push({
        type: PartType.Element,
        index,
      });
    } else if (value === marker) {
      const caseSensitiveName = extractCaseSensitiveAttributeName(
        strings[holes.length]!,
      );

      DEBUG: {
        if (caseSensitiveName?.toLowerCase() !== name) {
          throw new Error(
            `The attribute name must be "${name}", but got "${caseSensitiveName}". There may be a unclosed tag or a duplicate attribute:\n` +
              reportPart(
                { type: PartType.Attribute, name, node: element },
                ERROR_MAKER,
              ),
          );
        }
      }

      if (caseSensitiveName.length > 1 && caseSensitiveName[0] === '@') {
        holes.push({
          type: PartType.Event,
          index,
          name: caseSensitiveName.slice(1),
        });
      } else if (caseSensitiveName.length > 1 && caseSensitiveName[0] === '.') {
        holes.push({
          type: PartType.Property,
          index,
          name: caseSensitiveName.slice(1),
        });
      } else {
        holes.push({
          type: PartType.Attribute,
          index,
          name: caseSensitiveName,
        });
      }
    } else {
      DEBUG: {
        if (name.includes(marker)) {
          throw new Error(
            'Expressions are not allowed as an attribute name:\n' +
              reportPart(
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
              reportPart(
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

    element.removeAttribute(name);
  }
}

function parseChildren(
  strings: readonly string[],
  values: readonly unknown[],
  marker: string,
  rootNode: Node,
): Hole[] {
  const walker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
  const holes: Hole[] = [];

  let currentNode: ChildNode | null;
  let index = 0;

  while ((currentNode = walker.nextNode() as ChildNode | null) !== null) {
    switch (currentNode.nodeType) {
      case Node.ELEMENT_NODE: {
        DEBUG: {
          if ((currentNode as Element).tagName.includes(marker.toUpperCase())) {
            throw new Error(
              'Expressions are not allowed as a tag name:\n' +
                reportPart(
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
          let hint = '';
          DEBUG: {
            hint = nameOf(values[holes.length]);
          }
          (currentNode as Comment).data = hint;
          holes.push({
            type: PartType.ChildNode,
            index,
          });
        } else {
          DEBUG: {
            if ((currentNode as Comment).data.includes(marker)) {
              throw new Error(
                'Expressions inside a comment must make up the entire comment value:\n' +
                  reportPart(
                    { type: PartType.Node, node: currentNode },
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
              type: PartType.Node,
              index,
            });
            index++;
          }

          const tailComponent = components[tailCompoent]!;

          if (tailComponent !== '') {
            // Reuse the current node.
            (currentNode as Text).data = tailComponent;
          } else {
            walker.currentNode = currentNode.previousSibling!;
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
    assertNumberOfHoles(values.length, holes.length, strings);
  }

  return holes;
}

function assertNumberOfValues(
  expectedLength: number,
  actualLength: number,
): void {
  if (expectedLength !== actualLength) {
    throw new Error(
      `The number of values must be ${expectedLength}, but got ${actualLength}. There may be multiple holes indicating the same attribute.`,
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

function trimTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}
