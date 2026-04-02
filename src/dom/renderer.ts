import { type Scope, wrap } from '../core.js';
import { Slot } from '../slot.js';
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
import {
  createTreeWalker,
  type DOMHole,
  type DOMTemplate,
  type DOMTemplateRenderer,
  type DOMTemplateResult,
} from './template.js';

const TEXT_NODE = '#text';
const COMMENT_NODE = '#comment';

export interface DOMRenderer extends DOMTemplateRenderer {
  readonly container: Element;
  renderChildNodePart(): DOMPart.ChildNodePart;
}

export class ClientRenderer implements DOMRenderer {
  private readonly _container: Element;

  constructor(container: Element) {
    this._container = container;
  }

  get container(): Element {
    return this._container;
  }

  renderChildNodePart(): DOMPart.ChildNodePart {
    return createChildNodePart(this._container.ownerDocument.createComment(''));
  }

  renderTemplate(
    template: DOMTemplate,
    exprs: readonly unknown[],
    scope: Scope<DOMPart>,
  ): DOMTemplateResult {
    return renderTemplate(
      template,
      exprs,
      scope,
      this._container.ownerDocument,
    );
  }
}

export class HydrationRenderer implements DOMRenderer {
  private readonly _targetWalker: TreeWalker;

  constructor(container: Element) {
    this._targetWalker = createTreeWalker(container);
  }

  get container(): Element {
    return this._targetWalker.root as Element;
  }

  renderTemplate(
    template: DOMTemplate,
    exprs: readonly unknown[],
    scope: Scope<DOMPart>,
  ): DOMTemplateResult {
    return hydrateTemplate(template, exprs, scope, this._targetWalker);
  }

  renderChildNodePart(): DOMPart.ChildNodePart {
    return createChildNodePart(popNode(COMMENT_NODE, this._targetWalker));
  }
}

function hydrateTemplate(
  template: DOMTemplate,
  exprs: readonly unknown[],
  scope: Scope<DOMPart>,
  targetWalker: TreeWalker,
): DOMTemplateResult {
  const templateWalker = createTreeWalker(
    targetWalker.root.ownerDocument!.importNode(template.element.content),
  );
  const holes = template.holes;
  const totalHoles = holes.length;
  const childNodes: ChildNode[] = [];
  const slots: Slot<DOMPart>[] = new Array(totalHoles);
  let nodeIndex = 0;
  let holeIndex = 0;

  for (
    let templateNode: Node | null;
    (templateNode = templateWalker.nextNode()) !== null;
    nodeIndex++
  ) {
    const hydratedNodes: ChildNode[] = [];

    for (; holeIndex < totalHoles; holeIndex++) {
      const hole = holes[holeIndex]!;
      if (hole.index !== nodeIndex) {
        break;
      }

      let part: DOMPart;
      if (hole.type === PART_TYPE_TEXT) {
        part = hydrateTextPart(targetWalker, hole, hydratedNodes);
      } else if (hole.type === PART_TYPE_CHILD_NODE) {
        part = createChildNodePart(popNode(COMMENT_NODE, targetWalker));
        hydratedNodes.push(part.node);
      } else {
        if (hydratedNodes.length === 0) {
          hydratedNodes.push(
            popNode(templateNode.nodeName, targetWalker) as Element,
          );
        }
        const currentNode = targetWalker.currentNode as Element;
        switch (hole.type) {
          case PART_TYPE_ATTRIBUTE:
            part = createAttributePart(currentNode, hole.name);
            break;
          case PART_TYPE_EVENT:
            part = createEventPart(currentNode, hole.name);
            break;
          case PART_TYPE_ELEMENT:
            part = createElementPart(currentNode);
            break;
          case PART_TYPE_LIVE:
            part = createLivePart(currentNode, hole.name);
            break;
          case PART_TYPE_PROPERTY:
            part = createPropertyPart(currentNode, hole.name);
            break;
        }
      }

      slots[holeIndex] = new Slot(part, wrap(exprs[holeIndex]), scope);
    }

    if (hydratedNodes.length === 0) {
      hydratedNodes.push(
        popNode(templateNode.nodeName, targetWalker) as ChildNode,
      );
    }

    if (templateNode.parentNode === templateWalker.root) {
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

function hydrateTextPart(
  treeWalker: TreeWalker,
  hole: DOMHole.TextHole,
  hydratedNodes: ChildNode[],
): DOMPart.TextPart {
  if (hydratedNodes.length > 0) {
    popNode(COMMENT_NODE, treeWalker);
  }
  if (hole.leadingSpan > 0) {
    hydratedNodes.push(popNode(TEXT_NODE, treeWalker));
    popNode(COMMENT_NODE, treeWalker);
  }
  const part = createTextPart(popNode(TEXT_NODE, treeWalker));
  hydratedNodes.push(part.node);
  if (hole.trailingSpan > 0) {
    popNode(COMMENT_NODE, treeWalker);
    hydratedNodes.push(popNode(TEXT_NODE, treeWalker));
  }
  return part;
}

function renderTemplate(
  template: DOMTemplate,
  exprs: readonly unknown[],
  scope: Scope<DOMPart>,
  ownerDocument: Document,
): DOMTemplateResult {
  const root = ownerDocument.importNode(template.element.content, true);
  const holes = template.holes;
  const slots: Slot<DOMPart>[] = new Array(holes.length);
  const childNodes = Array.from(root.childNodes);

  if (holes.length > 0) {
    const templateWalker = createTreeWalker(root);
    let nodeIndex = 0;

    for (let i = 0, l = holes.length; i < l; i++) {
      const hole = holes[i]!;

      for (; nodeIndex <= hole.index; nodeIndex++) {
        if (templateWalker.nextNode() === null) {
          throw new Error(
            'There is no node that the hole indicates. The template may have been modified.',
          );
        }
      }

      const currentNode = templateWalker.currentNode;
      let part: DOMPart;

      switch (hole.type) {
        case PART_TYPE_ATTRIBUTE:
          part = createAttributePart(currentNode as Element, hole.name);
          break;
        case PART_TYPE_EVENT:
          part = createEventPart(currentNode as Element, hole.name);
          break;
        case PART_TYPE_CHILD_NODE:
          part = createChildNodePart(currentNode as Comment);
          break;
        case PART_TYPE_ELEMENT:
          part = createElementPart(currentNode as Element);
          break;
        case PART_TYPE_LIVE:
          part = createLivePart(currentNode as Element, hole.name);
          break;
        case PART_TYPE_PROPERTY:
          part = createPropertyPart(currentNode as Element, hole.name);
          break;
        case PART_TYPE_TEXT:
          part = splitTextPart(templateWalker, hole);
          break;
      }

      slots[i] = new Slot(part, wrap(exprs[i]!), scope);
    }
  }

  return { childNodes, slots };
}

function popNode(
  expectedName: typeof COMMENT_NODE,
  treeWalker: TreeWalker,
): Comment;
function popNode(expectedName: typeof TEXT_NODE, treeWalker: TreeWalker): Text;
function popNode(expectedName: string, treeWalker: TreeWalker): Node;
function popNode(expectedName: string, treeWalker: TreeWalker): Node {
  const node = treeWalker.nextNode();

  if (node === null || node.nodeName !== expectedName) {
    throw new Error(
      `Hydration failed because the node name mismatches. ${expectedName} is expected here, but got ${node?.nodeName}.`,
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
  if (hole.trailingSpan > 0) {
    currentNode = currentNode.splitText(0);
  }
  treeWalker.currentNode = currentNode;
  return part;
}
