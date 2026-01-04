import { formatNode } from './debug/node.js';

interface NodeTypeMap {
  [Node.COMMENT_NODE]: Comment;
  [Node.ELEMENT_NODE]: Element;
  [Node.TEXT_NODE]: Text;
}

export class HydrationError extends Error {
  readonly targetTree: TreeWalker;

  constructor(targetTree: TreeWalker, message: string) {
    DEBUG: {
      message +=
        '\n' + formatNode(targetTree.currentNode, '[[ERROR IN HERE!]]');
    }

    super(message);

    this.targetTree = targetTree;
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

export function replaceMarkerNode(
  targetTree: TreeWalker,
  markerNode: Comment,
): void {
  treatNodeType(
    Node.COMMENT_NODE,
    targetTree.nextNode(),
    targetTree,
  ).replaceWith(markerNode);
  targetTree.currentNode = markerNode;
}

export function splitText(targetTree: TreeWalker): Text {
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

export function treatNodeName(
  expectedName: string,
  node: Node | null,
  targetTree: TreeWalker,
): Node {
  if (node === null || node.nodeName !== expectedName) {
    throw new HydrationError(
      targetTree,
      `Hydration is failed because the node type is mismatched. ${expectedName} is expected here, but got ${node?.nodeName}.`,
    );
  }

  return node;
}

export function treatNodeType<TExpectedType extends keyof NodeTypeMap>(
  expectedType: TExpectedType,
  node: Node | null,
  targetTree: TreeWalker,
): NodeTypeMap[TExpectedType] {
  if (node === null || node.nodeType !== expectedType) {
    throw new HydrationError(
      targetTree,
      `Hydration is failed because the node type is mismatched. ${expectedType} is expected here, but got ${node?.nodeType}.`,
    );
  }

  return node as NodeTypeMap[TExpectedType];
}
