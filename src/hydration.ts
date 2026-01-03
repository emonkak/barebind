import { formatNode } from './debug/node.js';

interface NodeTypeMap {
  [Node.COMMENT_NODE]: Comment;
  [Node.ELEMENT_NODE]: Element;
  [Node.TEXT_NODE]: Text;
}

export class HydrationError extends Error {
  readonly treeWalker: TreeWalker;

  constructor(treeWalker: TreeWalker, message: string) {
    DEBUG: {
      message +=
        '\n' + formatNode(treeWalker.currentNode, '[[ERROR IN HERE!]]');
    }

    super(message);

    this.treeWalker = treeWalker;
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
  treeWalker: TreeWalker,
  markerNode: Comment,
): void {
  treatNodeType(
    Node.COMMENT_NODE,
    treeWalker.nextNode(),
    treeWalker,
  ).replaceWith(markerNode);
  treeWalker.currentNode = markerNode;
}

export function splitText(treeWalker: TreeWalker): Text {
  const previousNode = treeWalker.currentNode;
  const currentNode = treeWalker.nextNode();

  if (
    previousNode instanceof Text &&
    (currentNode === null || currentNode.previousSibling === previousNode)
  ) {
    const splittedText = previousNode.ownerDocument.createTextNode('');
    previousNode.after(splittedText);
    treeWalker.currentNode = splittedText;
    return splittedText;
  } else {
    return treatNodeType(Node.TEXT_NODE, currentNode, treeWalker);
  }
}

export function treatNodeName(
  expectedName: string,
  node: Node | null,
  treeWalker: TreeWalker,
): Node {
  if (node === null || node.nodeName !== expectedName) {
    throw new HydrationError(
      treeWalker,
      `Hydration is failed because the node type is mismatched. ${expectedName} is expected here, but got ${node?.nodeName}.`,
    );
  }

  return node;
}

export function treatNodeType<TExpectedType extends keyof NodeTypeMap>(
  expectedType: TExpectedType,
  node: Node | null,
  treeWalker: TreeWalker,
): NodeTypeMap[TExpectedType] {
  if (node === null || node.nodeType !== expectedType) {
    throw new HydrationError(
      treeWalker,
      `Hydration is failed because the node type is mismatched. ${expectedType} is expected here, but got ${node?.nodeType}.`,
    );
  }

  return node as NodeTypeMap[TExpectedType];
}
