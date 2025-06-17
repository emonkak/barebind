import { inspectNode } from './debug.js';

const ACTUAL_NODE_MAKER = '[[ACTUAL NODE IN HERE!]]';

interface NodeNameMap extends HTMLElementTagNameMap {
  '#comment': Comment;
  '#text': Text;
}

type InferNode<T extends string> = T extends keyof NodeNameMap
  ? NodeNameMap[T]
  : ChildNode;

export class HydrationTree {
  private readonly _treeWalker: TreeWalker;

  constructor(root: Node) {
    this._treeWalker = root.ownerDocument!.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
  }

  peekNode<T extends string>(expectedName: T): InferNode<T> {
    const previousNode = this._treeWalker.currentNode;
    const nextNode = this._treeWalker.nextNode();
    if (nextNode === null) {
      throw new HydrationError(
        `Hydration is failed because there is no node. ${expectedName} node is expected here.`,
      );
    }
    assertNode(nextNode, expectedName);
    this._treeWalker.currentNode = previousNode;
    return nextNode;
  }

  popNode<T extends string>(expectedName: T): InferNode<T> {
    const currentNode = this._treeWalker.nextNode();
    if (currentNode === null) {
      throw new HydrationError(
        `Hydration is failed because there is no node. ${expectedName} node is expected here.`,
      );
    }
    assertNode(currentNode, expectedName);
    return currentNode;
  }

  replaceWith(node: Node): void {
    (this._treeWalker.currentNode as ChildNode).replaceWith(node);
    this._treeWalker.currentNode = node;
  }
}

export class HydrationError extends Error {}

function assertNode<T extends string>(
  actualNode: Node,
  expectedName: T,
): asserts actualNode is InferNode<T> {
  if (actualNode.nodeName !== expectedName) {
    throw new HydrationError(
      `Hydration is failed because the node is mismatched. ${expectedName} node is expected here:\n` +
        inspectNode(actualNode, ACTUAL_NODE_MAKER),
    );
  }
}
