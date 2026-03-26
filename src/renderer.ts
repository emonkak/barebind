import type { Session, TemplateMode } from './core.js';
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
} from './dom.js';
import { HydrationError } from './error.js';
import { Slot } from './slot.js';

export interface Template {
  element: HTMLTemplateElement;
  holes: DOMHole[];
  mode: TemplateMode;
}

export interface TemplateResult {
  childNodes: readonly ChildNode[];
  slots: readonly Slot<unknown, DOMPart>[];
}

export class DOMRenderRoot {
  private readonly _container: Element;

  constructor(container: Element) {
    this._container = container;
  }

  get container(): Element {
    return this._container;
  }

  get scope(): null {
    return null;
  }

  renderChildNodePart(namespaceURI: string | null): DOMPart.ChildNodePart {
    return createChildNodePart(
      this._container.ownerDocument.createComment(''),
      namespaceURI,
    );
  }

  renderElementPart(
    type: string,
    namespaceURI: string | null,
  ): DOMPart.ElementPart {
    return createElementPart(
      this._container.ownerDocument.createElementNS(namespaceURI, type),
    );
  }

  renderTemplatePart(
    template: Template,
    exprs: readonly unknown[],
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const fragment = template.element.ownerDocument.importNode(
      template.element.content,
      true,
    );
    const holes = template.holes;
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
              getNamespaceURI(currentNode, template.mode),
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

  renderTextPart(): DOMPart.TextPart {
    return createTextPart(this._container.ownerDocument.createTextNode(''));
  }
}

export class DOMHydrationRoot {
  private readonly _target: TreeWalker;

  constructor(container: Element) {
    this._target = createTreeWalker(container);
  }

  get container(): Element {
    return this._target.root as Element;
  }

  renderTemplatePart(
    template: Template,
    exprs: readonly unknown[],
    session: Session,
  ): TemplateResult {
    const { context } = session;
    const fragment = template.element.content;
    const hydrationTemplate = createTreeWalker(fragment);
    const holes = template.holes;
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
        let currentPart: DOMPart;

        if (hole.index !== nodeIndex) {
          break;
        }

        if (hole.type === DOM_PART_TYPE_TEXT) {
          currentPart = hydrateTextPart(
            this._target,
            hole,
            hydratedNodes.length > 0,
          );
          hydratedNodes.push(currentPart.node);
        } else if (hole.type === DOM_PART_TYPE_CHILD_NODE) {
          currentPart = createChildNodePart(
            popNode('#comment', this._target),
            getNamespaceURI(this._target.currentNode, template.mode),
          );
          hydratedNodes.push(currentPart.node);
        } else {
          let currentNode: Element;
          if (hydratedNodes.length > 0) {
            currentNode = this._target.currentNode as Element;
          } else {
            currentNode = popNode(
              templateNode.nodeName,
              this._target,
            ) as Element;
            hydratedNodes.push(currentNode);
          }
          switch (hole.type) {
            case DOM_PART_TYPE_ATTRIBUTE:
              currentPart = createAttributePart(currentNode, hole.name);
              break;
            case DOM_PART_TYPE_EVENT:
              currentPart = createEventPart(currentNode, hole.name);
              break;
            case DOM_PART_TYPE_ELEMENT:
              currentPart = createElementPart(currentNode);
              break;
            case DOM_PART_TYPE_LIVE:
              currentPart = createLivePart(currentNode, hole.name);
              break;
            case DOM_PART_TYPE_PROPERTY:
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

  renderChildNodePart(namespaceURI: string | null): DOMPart.ChildNodePart {
    return createChildNodePart(popNode('#comment', this._target), namespaceURI);
  }

  renderTextPart(): DOMPart.TextPart {
    return createTextPart(popNode('#text', this._target));
  }

  renderElementPart(
    type: string,
    _namespaceURI: string | null,
  ): DOMPart.ElementPart {
    return createElementPart(popNode(type, this._target) as Element);
  }
}

function getNamespaceURI(node: Node, mode: TemplateMode): string | null {
  return node.lookupNamespaceURI(null) ?? getNamespaceURIByTagName(mode);
}

function hydrateTextPart(
  treeWalker: TreeWalker,
  hole: DOMHole.TextHole,
  contiguous: boolean,
): DOMPart.TextPart {
  let currentNode = treeWalker.currentNode;
  if (contiguous) {
    currentNode = popNode('#comment', treeWalker);
  }
  if (hole.leadingSpan > 0) {
    popNode('#text', treeWalker);
    currentNode = popNode('#comment', treeWalker);
  }
  const part = createTextPart(popNode('#text', treeWalker));
  if (hole.trailingSpan > 0) {
    popNode('#comment', treeWalker);
    currentNode = popNode('#text', treeWalker);
  } else {
    currentNode = part.node;
  }
  treeWalker.currentNode = currentNode;
  return part;
}

export function popNode(
  expectedName: '#comment',
  treeWalker: TreeWalker,
): Comment;
export function popNode(expectedName: '#text', treeWalker: TreeWalker): Text;
export function popNode(expectedName: string, treeWalker: TreeWalker): Node;
export function popNode(expectedName: string, treeWalker: TreeWalker): Node {
  const node = treeWalker.nextNode();

  if (node === null || node.nodeName !== expectedName) {
    throw new HydrationError(
      treeWalker.currentNode,
      `Hydration is failed because the node name is mismatched. ${expectedName} is expected here, but got ${node?.nodeName}.`,
    );
  }

  return node;
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
