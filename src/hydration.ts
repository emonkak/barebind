import { inspectNode } from './debug.js';

const ACTUAL_NODE_MAKER = '[[ACTUAL NODE IN HERE!]]';

interface NodeTypeMap {
  [Node.ELEMENT_NODE]: Element;
  [Node.TEXT_NODE]: Text;
  [Node.COMMENT_NODE]: Comment;
}

type InferNode<T extends number> = T extends keyof NodeTypeMap
  ? NodeTypeMap[T]
  : ChildNode;

export class HydrationTree {
  private readonly _treeWalker: TreeWalker;

  constructor(root: Node) {
    this._treeWalker = root.ownerDocument!.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
  }

  peekNode(): ChildNode {
    const previousNode = this._treeWalker.currentNode;
    const nextNode = this._treeWalker.nextNode();
    if (nextNode === null) {
      throw new HydrationError('Hydration is failed because there is no node.');
    }
    this._treeWalker.currentNode = previousNode;
    return nextNode as ChildNode;
  }

  popNode<T extends number>(
    expectedType: T,
    expectedName: string,
  ): InferNode<T> {
    const currentNode = this._treeWalker.nextNode();
    if (currentNode === null) {
      throw new HydrationError(
        `Hydration is failed because there is no node. ${expectedName.toLowerCase()} node is expected here.`,
      );
    }
    ensureNode(currentNode, expectedType, expectedName);
    return currentNode;
  }

  replaceNode(node: Node): void {
    (this._treeWalker.currentNode as ChildNode).replaceWith(node);
    this._treeWalker.currentNode = node;
  }
}

export class HydrationError extends Error {}

export function ensureNode<T extends number>(
  actualNode: Node,
  expectedType: T,
  expectedName: string,
): asserts actualNode is InferNode<T> {
  if (
    actualNode.nodeType !== expectedType ||
    actualNode.nodeName !== expectedName
  ) {
    throw new HydrationError(
      `Hydration is failed because the node is mismatched. ${expectedName.toLowerCase()} node is expected here:\n` +
        inspectNode(actualNode, ACTUAL_NODE_MAKER),
    );
  }
}
