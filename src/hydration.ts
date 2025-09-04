import { formatNode } from './debug/node.js';
import type { HydrationTarget } from './internal.js';

export class HydrationError extends Error {
  readonly target: HydrationTarget;

  constructor(target: HydrationTarget, message: string) {
    DEBUG: {
      message += '\n' + formatNode(target.currentNode, '[[ERROR IN HERE!]]');
    }

    super(message);

    this.target = target;
  }
}

interface NodeTypeMap {
  [Node.COMMENT_NODE]: Comment;
  [Node.ELEMENT_NODE]: Element;
  [Node.TEXT_NODE]: Text;
}

/**
 * @internal
 */
export function createHydrationTarget(container: Element): HydrationTarget {
  return container.ownerDocument.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
}

/**
 * @internal
 */
export function mountMarkerNode(
  target: HydrationTarget,
  markerNode: Comment,
): void {
  treatNodeType(Node.COMMENT_NODE, target.nextNode(), target).replaceWith(
    markerNode,
  );
  target.currentNode = markerNode;
}

/**
 * @internal
 */
export function splitText(target: HydrationTarget): Text {
  const previousNode = target.currentNode;
  const currentNode = target.nextNode();

  if (
    previousNode instanceof Text &&
    (currentNode === null || currentNode.previousSibling === previousNode)
  ) {
    const splittedText = previousNode.ownerDocument.createTextNode('');
    previousNode.after(splittedText);
    target.currentNode = splittedText;
    return splittedText;
  } else {
    return treatNodeType(Node.TEXT_NODE, currentNode, target);
  }
}

/**
 * @internal
 */
export function treatNodeName(
  expectedName: string,
  node: Node | null,
  target: HydrationTarget,
): Node {
  if (node === null || node.nodeName !== expectedName) {
    throw new HydrationError(
      target,
      `Hydration is failed because the node type is mismatched. ${expectedName} is expected here, but got ${node?.nodeName}.`,
    );
  }

  return node;
}

/**
 * @internal
 */
export function treatNodeType<TExpectedType extends keyof NodeTypeMap>(
  expectedType: TExpectedType,
  node: Node | null,
  target: HydrationTarget,
): NodeTypeMap[TExpectedType] {
  if (node === null || node.nodeType !== expectedType) {
    throw new HydrationError(
      target,
      `Hydration is failed because the node type is mismatched. ${expectedType} is expected here, but got ${node?.nodeType}.`,
    );
  }

  return node as NodeTypeMap[TExpectedType];
}
