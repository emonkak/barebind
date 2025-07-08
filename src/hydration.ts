import { inspectNode } from './debug.js';

interface ExpectedNodeTypeMap {
  [Node.ELEMENT_NODE]: Element;
  [Node.TEXT_NODE]: Text;
  [Node.COMMENT_NODE]: Comment;
}

type InferNode<T extends number> = T extends keyof ExpectedNodeTypeMap
  ? ExpectedNodeTypeMap[T]
  : ExpectedNodeTypeMap[keyof ExpectedNodeTypeMap];

export class HydrationTree {
  private readonly _treeWalker: TreeWalker;

  private _lookaheadNode: Node | null;

  constructor(root: Node) {
    this._treeWalker = root.ownerDocument!.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
    this._lookaheadNode = this._treeWalker.nextNode();
  }

  peekNode<T extends number>(
    expectedType: T,
    expectedName: string,
  ): InferNode<T> {
    const lookaheadNode = this._lookaheadNode;
    ensureNode(lookaheadNode, expectedType, expectedName);
    return lookaheadNode;
  }

  popNode<T extends number>(
    expectedType: T,
    expectedName: string,
  ): InferNode<T> {
    const lookaheadNode = this._lookaheadNode;
    ensureNode(lookaheadNode, expectedType, expectedName);
    this._lookaheadNode = this._treeWalker.nextNode();
    return lookaheadNode;
  }

  splitText(): this {
    const currentNode = this._treeWalker.currentNode;
    const lookaheadNode = this._lookaheadNode;

    if (
      narrowNode(currentNode, Node.TEXT_NODE) &&
      (lookaheadNode === null || lookaheadNode.previousSibling === currentNode)
    ) {
      const splittedText = currentNode.ownerDocument.createTextNode('');
      currentNode.after(splittedText);
      this._lookaheadNode = splittedText;
    }

    return this;
  }
}

export class HydrationError extends Error {}

function ensureNode<T extends number>(
  actualNode: Node | null,
  expectedType: T,
  expectedName: string,
): asserts actualNode is InferNode<T> {
  if (actualNode === null) {
    throw new HydrationError(
      `Hydration is failed because there is no node. ${expectedName} node is expected here.`,
    );
  }

  if (
    actualNode.nodeType !== expectedType ||
    actualNode.nodeName !== expectedName
  ) {
    throw new HydrationError(
      `Hydration is failed because the node is mismatched. ${expectedName} node is expected here:\n` +
        inspectNode(actualNode, `[[${actualNode.nodeName} IS IN HERE!]]`),
    );
  }
}

function narrowNode<T extends number>(
  actualNode: Node,
  expectedType: T,
): actualNode is InferNode<T> {
  return actualNode.nodeType === expectedType;
}
