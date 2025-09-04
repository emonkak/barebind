import { formatNode } from './debug/node.js';
import type { HydrationTarget } from './internal.js';

export class HydrationError extends Error {
  readonly targetTree: HydrationTarget;

  constructor(targetTree: HydrationTarget, message: string) {
    DEBUG: {
      message +=
        '\n' + formatNode(targetTree.currentNode, '[[ERROR IN HERE!]]');
    }

    super(message);

    this.targetTree = targetTree;
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
  targetTree: HydrationTarget,
  markerNode: Comment,
): void {
  treatNodeType(
    Node.COMMENT_NODE,
    targetTree.nextNode(),
    targetTree,
  ).replaceWith(markerNode);
  targetTree.currentNode = markerNode;
}

/**
 * @internal
 */
export function splitText(targetTree: HydrationTarget): Text {
  const previousNode = targetTree.currentNode;
  const currentNode = targetTree.nextNode();

  if (
    previousNode instanceof Text &&
    (currentNode === null || currentNode.previousSibling === previousNode)
  ) {
    const splittedText = previousNode.ownerDocument.createTextNode('');
    previousNode.after(splittedText);
    targetTree.currentNode = splittedText;
    return splittedText;
  } else {
    return treatNodeType(Node.TEXT_NODE, currentNode, targetTree);
  }
}

/**
 * @internal
 */
export function treatNodeName(
  expectedName: string,
  node: Node | null,
  targetTree: HydrationTarget,
): Node {
  if (node === null || node.nodeName !== expectedName) {
    throw new HydrationError(
      targetTree,
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
  targetTree: HydrationTarget,
): NodeTypeMap[TExpectedType] {
  if (node === null || node.nodeType !== expectedType) {
    throw new HydrationError(
      targetTree,
      `Hydration is failed because the node type is mismatched. ${expectedType} is expected here, but got ${node?.nodeType}.`,
    );
  }

  return node as NodeTypeMap[TExpectedType];
}
