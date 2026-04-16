import {
  AttributePart,
  type Block,
  ChildNodePart,
  ElementPart,
  EventPart,
  LivePart,
  type Part,
  PartType,
  PropertyPart,
  TextPart,
} from './part.js';

const PLACEHOLDER = '??__HOLE__??';

const LEADING_NEWLINE_PATTERN = /^\s*\n/;
const TRAILING_NEWLINE_PATTERN = /\n\s*$/;

// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
const ATTRIBUTE_NAME_CLASS = String.raw`[^ "'>/=\p{Control}\p{Noncharacter_Code_Point}]`;
// https://infra.spec.whatwg.org/#ascii-whitespace
const WHITESPACE_CLASS = String.raw`[\t\n\f\r ]`;
const QUOTE_CLASS = `["']`;
const ATTRIBUTE_NAME_PATTERN = new RegExp(
  `${ATTRIBUTE_NAME_CLASS}+(?=${WHITESPACE_CLASS}*=${WHITESPACE_CLASS}*${QUOTE_CLASS}?$)`,
  'u',
);

const Primitive = Symbol('Primitive');
const Fragment = Symbol('Fragment');

const MutationType = {
  Insert: 0,
  Update: 1,
  MoveAfter: 2,
  MoveBefore: 3,
  Remove: 4,
} as const;

export type Hole = any;

export type Mutation =
  | {
      type: typeof MutationType.Insert;
      value: unknown;
      index: number;
      afterIndex: number;
    }
  | {
      type: typeof MutationType.Update;
      patch: Patch<ChildNodePart>;
      index: number;
    }
  | {
      type: typeof MutationType.MoveAfter | typeof MutationType.MoveBefore;
      patch: Patch<ChildNodePart>;
      oldIndex: number;
      newIndex: number;
      afterIndex: number;
    }
  | {
      type: typeof MutationType.Remove;
      index: number;
    };

export type Patch<TPart = Part> = (part: TPart) => void;

export class Directive {
  type: any;
  value: any;
  key: unknown;

  constructor(type: any, value: any, key?: unknown) {
    this.type = type;
    this.value = value;
    this.key = key;
  }
}

export type DirectiveNode =
  | { type: typeof Primitive; value: unknown; key: unknown }
  | { type: typeof Fragment; value: DirectiveNode[]; key: unknown }
  | {
      type: (props: unknown) => unknown;
      value: {
        props: unknown;
        children: DirectiveNode | undefined;
      };
      key: unknown;
    }
  | {
      type: readonly string[];
      value: {
        exprs: DirectiveNode[];
        mode: string;
      };
      key: unknown;
    };

export class ComponentBlock implements Block {
  part: ChildNodePart;

  constructor(part: ChildNodePart) {
    this.part = part;
  }

  get firstNode(): ChildNode | null {
    return this.part.firstNode;
  }

  mount(parentPart: ChildNodePart): void {
    parentPart.node.before(this.part.node);
    this.part.commit();
  }

  unmount(_parentPart: ChildNodePart): void {
    this.part.revert();
    this.part.node.remove();
  }
}

export class FragmentBlock implements Block {
  parts: ChildNodePart[];

  constructor(parts: ChildNodePart[]) {
    this.parts = parts;
  }

  get firstNode(): ChildNode | null {
    return this.parts[0]?.firstNode ?? null;
  }

  mount(parentPart: ChildNodePart): void {
    for (const part of this.parts) {
      parentPart.node.before(part.node);
      part.commit();
    }
  }

  unmount(_parentPart: ChildNodePart): void {
    for (const part of this.parts) {
      part.revert();
      part.node.remove();
    }
  }
}

export class Template {
  template: HTMLTemplateElement;
  holes: Hole[];

  static parse(strings: readonly string[], exprs: unknown[]): Template {
    const template = document.createElement('template');
    template.innerHTML = strings.join(PLACEHOLDER);
    const holes = parseChildren(strings, PLACEHOLDER, template.content);
    if (exprs.length !== holes.length) {
      throw new Error(
        `The number of holes must be ${exprs.length}, but got ${holes.length}. Multiple holes indicate the same attribute.`,
      );
    }
    return new Template(template, holes);
  }

  constructor(template: HTMLTemplateElement, holes: Hole[]) {
    this.template = template;
    this.holes = holes;
  }

  createBlock(): TemplateBlock {
    const ownerDocument = this.template.ownerDocument;
    const root = ownerDocument.importNode(this.template.content, true);
    const nodes = Array.from(root.childNodes);
    const parts: Part[] = new Array(this.holes.length);

    if (this.holes.length > 0) {
      const walker = createTreeWalker(root);
      let nodeIndex = 0;

      for (let i = 0, l = this.holes.length; i < l; i++) {
        const hole = this.holes[i]!;

        for (; nodeIndex <= hole.index; nodeIndex++) {
          if (walker.nextNode() === null) {
            throw new Error(
              'There is no node that the hole indicates. The template may have been modified.',
            );
          }
        }

        let part: Part;

        switch (hole.type) {
          case PartType.Attribute:
            part = new AttributePart(walker.currentNode as Element, hole.name);
            break;
          case PartType.Event:
            part = new EventPart(walker.currentNode as Element, hole.name);
            break;
          case PartType.ChildNode:
            part = new ChildNodePart(walker.currentNode as Comment);
            break;
          case PartType.Element:
            part = new ElementPart(walker.currentNode as Element);
            break;
          case PartType.Live:
            part = new LivePart(walker.currentNode as Element, hole.name);
            break;
          case PartType.Property:
            part = new PropertyPart(walker.currentNode as Element, hole.name);
            break;
          case PartType.Text:
            part = splitTextPart(walker, hole);
            break;
        }

        parts[i] = part!;
      }
    }

    return new TemplateBlock(parts, nodes);
  }
}

export class TemplateBlock implements Block {
  parts: Part[];

  nodes: ChildNode[];

  constructor(parts: Part[], nodes: ChildNode[]) {
    this.parts = parts;
    this.nodes = nodes;
  }

  get firstNode(): ChildNode | null {
    const headPart = this.parts[0];
    const headNode = this.nodes[0];
    return headPart instanceof ChildNodePart && headPart.node === headNode
      ? headPart.firstNode
      : (headNode ?? null);
  }

  mount(parentPart: ChildNodePart): void {
    parentPart.node.before(...this.nodes);

    for (const part of this.parts) {
      part.commit();
    }
  }

  unmount(_parentPart: ChildNodePart): void {
    for (const part of this.parts) {
      if (part instanceof ChildNodePart && this.nodes.includes(part.node)) {
        part.revert();
      }
    }

    for (const node of this.nodes) {
      node.remove();
    }
  }
}

export class Renderer {
  templateCache: WeakMap<readonly string[], Template> = new WeakMap();

  render(node: DirectiveNode): unknown {
    if (node.type === Primitive) {
      return node.value;
    } else if (node.type === Fragment) {
      const childParts = node.value.map(
        (child) =>
          new ChildNodePart(
            document.createComment(''),
            this.render(child) as Block,
          ),
      );
      return new FragmentBlock(childParts);
    } else if (typeof node.type === 'function') {
      node.value.children = wrap(node.type.call(null, node.value.props));
      const part = new ChildNodePart(
        document.createComment(''),
        this.render(node.value.children) as Block,
      );
      return new ComponentBlock(part);
    } else {
      const template = this.templateCache.getOrInsertComputed(node.type, () =>
        Template.parse(node.type, node.value.exprs),
      );
      const block = template.createBlock();
      block.parts.forEach((part, i) => {
        part.value = this.render(node.value.exprs[i]!);
      });
      return block;
    }
  }

  diff(oldNode: DirectiveNode, newNode: DirectiveNode): Patch {
    if (oldNode.key === newNode.key) {
      if (oldNode.type === Primitive && newNode.type === Primitive) {
        return (parentPart) => {
          parentPart.value = newNode.value;
          parentPart.commit();
        };
      } else if (oldNode.type === Fragment && newNode.type === Fragment) {
        const mutations = this.diffChildren(
          oldNode.value.slice(),
          newNode.value,
        );

        return (parentPart) => {
          const block = parentPart.value as FragmentBlock;
          const oldParts = block.parts;
          const newParts: ChildNodePart[] = new Array(newNode.value.length);

          for (const mutation of mutations) {
            switch (mutation.type) {
              case MutationType.Insert: {
                const part = new ChildNodePart(
                  document.createComment(''),
                  mutation.value as Block,
                );
                const afterNode =
                  newParts[mutation.afterIndex]?.firstNode ?? parentPart.node;
                afterNode.before(part.node);
                part.commit();
                newParts[mutation.index] = part;
                break;
              }
              case MutationType.Update: {
                const part = oldParts[mutation.index]!;
                mutation.patch(part);
                newParts[mutation.index] = part;
                break;
              }
              case MutationType.Remove: {
                const part = oldParts[mutation.index]!;
                part.revert();
                part.node.remove();
                break;
              }
              case MutationType.MoveAfter: {
                const part = oldParts[mutation.oldIndex]!;
                part.moveBefore(newParts[mutation.afterIndex]!.firstNode);
                mutation.patch(part);
                newParts[mutation.newIndex] = part;
                break;
              }
              case MutationType.MoveBefore: {
                const part = oldParts[mutation.oldIndex]!;
                part.moveBefore(oldParts[mutation.afterIndex]!.firstNode);
                mutation.patch(part);
                newParts[mutation.newIndex] = part;
                break;
              }
            }
          }

          block.parts = newParts;
        };
      } else if (
        typeof oldNode.type === 'function' &&
        oldNode.type === newNode.type
      ) {
        newNode.value.children = wrap(
          newNode.type.call(null, newNode.value.props),
        );
        const patch = this.diff(
          oldNode.value.children!,
          newNode.value.children,
        );

        return (parentPart) => {
          const block = parentPart.value as ComponentBlock;
          patch(block.part);
        };
      } else if (
        typeof oldNode.type === 'object' &&
        oldNode.type === newNode.type
      ) {
        const patches = oldNode.value.exprs.map((oldExpr, i) =>
          this.diff(oldExpr, newNode.value.exprs[i]!),
        );

        return (part) => {
          const block = part.value as TemplateBlock;
          patches.forEach((patch, i) => {
            patch(block.parts[i]!);
          });
        };
      }
    }

    const newValue = this.render(newNode);

    return (part) => {
      part.value = newValue;
      part.commit();
    };
  }

  diffChildren(
    oldNodes: (DirectiveNode | undefined)[],
    newNodes: DirectiveNode[],
  ): Mutation[] {
    const oldKeys = oldNodes.map((node, index) => node!.key ?? index);
    const newKeys = newNodes.map((node, index) => node.key ?? index);
    const newMutations: Mutation[] = [];

    let oldHead = 0;
    let newHead = 0;
    let oldTail = oldKeys.length - 1;
    let newTail = newKeys.length - 1;
    let oldKeyToIndexMap: Map<unknown, number> | undefined;
    let newKeyToIndexMap: Map<unknown, number> | undefined;

    while (true) {
      if (newHead > newTail) {
        while (oldHead <= oldTail) {
          if (oldNodes[oldHead] !== undefined) {
            newMutations.push({
              type: MutationType.Remove,
              index: oldHead,
            });
          }
          oldHead++;
        }
        break;
      } else if (oldHead > oldTail) {
        while (newHead <= newTail) {
          newMutations.push({
            type: MutationType.Insert,
            value: this.render(newNodes[newHead]!),
            index: newHead,
            afterIndex: newTail + 1,
          });
          newHead++;
        }
        break;
      } else if (oldNodes[oldHead] === undefined) {
        oldHead++;
      } else if (oldNodes[oldTail] === undefined) {
        oldTail--;
      } else if (Object.is(oldKeys[oldHead]!, newKeys[newHead]!)) {
        newMutations.push({
          type: MutationType.Update,
          patch: this.diff(oldNodes[oldHead]!, newNodes[newHead]!),
          index: newHead,
        });
        oldHead++;
        newHead++;
      } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        newMutations.push({
          type: MutationType.Update,
          patch: this.diff(oldNodes[oldTail]!, newNodes[newTail]!),
          index: newTail,
        });
        oldTail--;
        newTail--;
      } else if (
        Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
        Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
      ) {
        newMutations.push({
          type: MutationType.MoveBefore,
          patch: this.diff(oldNodes[oldHead]!, newNodes[newTail]!),
          oldIndex: oldHead,
          newIndex: newHead,
          afterIndex: oldHead,
        });
        newMutations.push({
          type: MutationType.MoveAfter,
          patch: this.diff(oldNodes[oldTail]!, newNodes[newHead]!),
          oldIndex: oldTail,
          newIndex: newTail,
          afterIndex: newTail + 1,
        });
        oldHead++;
        newHead++;
        oldTail--;
        newTail--;
      } else {
        newKeyToIndexMap ??= buildKeyToIndexMap(newKeys, newHead, newTail);

        if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
          newMutations.push({
            type: MutationType.Remove,
            index: oldHead,
          });
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          newMutations.push({
            type: MutationType.Remove,
            index: oldTail,
          });
          oldTail--;
        } else {
          oldKeyToIndexMap ??= buildKeyToIndexMap(oldKeys, oldHead, oldTail);
          const oldIndex = oldKeyToIndexMap.get(newKeys[newTail]!);

          if (
            oldIndex !== undefined &&
            oldIndex >= oldHead &&
            oldIndex <= oldTail &&
            oldNodes[oldIndex] !== undefined
          ) {
            newMutations.push({
              type: MutationType.MoveAfter,
              patch: this.diff(oldNodes[oldIndex], newNodes[newTail]!),
              oldIndex,
              newIndex: newTail,
              afterIndex: newTail + 1,
            });
            oldNodes[oldIndex] = undefined;
          } else {
            newMutations.push({
              type: MutationType.Insert,
              value: this.render(newNodes[newTail]!),
              index: newTail,
              afterIndex: newTail + 1,
            });
          }

          newTail--;
        }
      }
    }

    return newMutations;
  }
}

export function html(
  strings: readonly string[],
  ...exprs: unknown[]
): Directive {
  return new Directive(strings, {
    exprs: exprs.map(wrap),
    mode: 'html',
  });
}

function buildKeyToIndexMap<T>(
  keys: T[],
  head: number,
  tail: number,
): Map<T, number> {
  const keyToIndexMap = new Map();
  for (let i = head; i <= tail; i++) {
    keyToIndexMap.set(keys[i]!, i);
  }
  return keyToIndexMap;
}

function createTreeWalker(root: DocumentFragment) {
  return root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
}

function extractAttributeName(s: string): string | undefined {
  return s.match(ATTRIBUTE_NAME_PATTERN)?.[0];
}

function parseAttribtues(
  element: Element,
  strings: readonly string[],
  marker: string,
  holes: Hole[],
  index: number,
): void {
  for (const attribute of Array.from(element.attributes)) {
    let hole: Hole;

    if (attribute.name === marker && attribute.value === '') {
      hole = {
        type: PartType.Element,
        index,
      };
    } else if (attribute.value === marker) {
      const name = extractAttributeName(strings[holes.length]!);

      DEBUG: {
        if (name?.toLowerCase() !== attribute.name) {
          throw new Error(
            `The attribute name must be "${attribute.name}", but got "${name}". There are unclosed tags or duplicate attributes.`,
          );
        }
      }

      switch (name[0]) {
        case '@':
          hole = {
            type: PartType.Event,
            index,
            name: name.slice(1),
          };
          break;
        case '$':
          hole = {
            type: PartType.Live,
            index,
            name: name.slice(1),
          };
          break;
        case '.':
          hole = {
            type: PartType.Property,
            index,
            name: name.slice(1),
          };
          break;
        default:
          hole = {
            type: PartType.Attribute,
            index,
            name,
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
  placeholder: string,
  fragment: DocumentFragment,
): Hole[] {
  const sourceTree = createTreeWalker(fragment);
  const holes = [];
  let nextNode = sourceTree.nextNode();
  let index = 0;

  while (nextNode !== null) {
    const currentNode = nextNode;
    switch (currentNode.nodeType) {
      case Node.ELEMENT_NODE: {
        DEBUG: {
          if ((currentNode as Element).localName.includes(placeholder)) {
            throw new Error('Expressions are not allowed as a tag name.');
          }
        }
        if ((currentNode as Element).hasAttributes()) {
          parseAttribtues(
            currentNode as Element,
            strings,
            placeholder,
            holes,
            index,
          );
        }
        break;
      }
      case Node.COMMENT_NODE: {
        if (
          stripTrailingSlash((currentNode as Comment).data).trim() ===
          placeholder
        ) {
          holes.push({
            type: PartType.ChildNode,
            index,
          });
          (currentNode as Comment).data = '';
        } else {
          DEBUG: {
            if ((currentNode as Comment).data.includes(placeholder)) {
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
          .split(placeholder)
          .map(stripWhitespaces);
        const normalizedText = components.join('');
        const tail = components.length - 1;
        let lastComponent = components[0]!;

        for (let i = 1; i <= tail; i++) {
          const component = components[i]!;
          holes.push({
            type: PartType.Text,
            index,
            leadingSpan: lastComponent.length,
            trailingSpan: i === tail ? component.length : 0,
          });
          lastComponent = component;
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

  return holes;
}

function splitTextPart(treeWalker: TreeWalker, hole: Hole): Part {
  let currentNode = treeWalker.currentNode as Text;
  if (currentNode.previousSibling?.nodeType === Node.TEXT_NODE) {
    currentNode = currentNode.splitText(0);
  }
  if (hole.leadingSpan > 0) {
    currentNode = currentNode.splitText(hole.leadingSpan);
  }
  const part = new TextPart(currentNode);
  if (hole.trailingSpan > 0) {
    currentNode = currentNode.splitText(0);
  }
  treeWalker.currentNode = currentNode;
  return part;
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

function wrap(value: unknown): DirectiveNode {
  return value instanceof Directive ? value : new Directive(Primitive, value);
}
