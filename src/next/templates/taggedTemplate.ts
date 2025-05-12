import type {
  Binding,
  DirectiveContext,
  EffectContext,
  Template,
  TemplateInstance,
  TemplateMode,
  UpdateContext,
} from '../coreTypes.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from '../template.js';

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

export class TaggedTemplate<TBinds extends readonly any[]>
  implements Template<TBinds, ChildNodePart>
{
  static parse<TBinds extends readonly any[]>(
    strings: readonly string[],
    binds: TBinds,
    placeholder: string,
    mode: TemplateMode,
  ): TaggedTemplate<TBinds> {
    const marker = createMarker(placeholder);
    const template = document.createElement('template');
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

  get element(): HTMLTemplateElement {
    return this._element;
  }

  get holes(): Hole[] {
    return this._holes;
  }

  render(
    binds: TBinds,
    context: DirectiveContext,
  ): TaggedTemplateInstance<TBinds> {
    const holes = this._holes;

    DEBUG: {
      assertNumberOfBinds(holes.length, binds.length);
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

          bindings[holeIndex] = context.resolveBinding(binds[holeIndex], part);
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

    return new TaggedTemplateInstance(bindings, childNodes);
  }

  resolveBinding(
    binds: TBinds,
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<TBinds, ChildNodePart> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'Template directive must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new TemplateBinding(this, binds, part);
  }
}

export class TaggedTemplateInstance<TBinds extends readonly any[]>
  implements TemplateInstance<TBinds, ChildNodePart>
{
  private readonly _bindings: Binding<unknown>[];

  private readonly _childNodes: ChildNode[];

  constructor(bindings: Binding<unknown>[], childNodes: ChildNode[]) {
    this._bindings = bindings;
    this._childNodes = childNodes;
  }

  get bindings(): Binding<unknown>[] {
    return this._bindings;
  }

  get childNodes(): ChildNode[] {
    return this._childNodes;
  }

  connect(context: UpdateContext): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.connect(context);
    }
  }

  bind(binds: TBinds, context: UpdateContext): void {
    DEBUG: {
      assertNumberOfBinds(this._bindings.length, binds.length);
    }

    for (let i = 0, l = this._bindings.length; i < l; i++) {
      const binding = this._bindings[i]!;
      binding.bind(binds[i]!, context);
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
    part.node.before(...this._childNodes);
  }

  unmount(): void {
    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }
  }

  commit(context: EffectContext): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      const binding = this._bindings[i]!;
      DEBUG: {
        if (binding.part.type === PartType.ChildNode) {
          binding.part.node.data = inspectValue(binding.directive);
        }
      }
      binding.commit(context);
    }
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
              inspectPart(
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

    element.removeAttribute(name);
  }
}

function parseChildren(
  strings: readonly string[],
  binds: readonly unknown[],
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
    assertNumberOfHoles(binds.length, holes.length, strings);
  }

  return holes;
}

function trimTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}
