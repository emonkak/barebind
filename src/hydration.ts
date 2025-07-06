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

  splitText(): Text {
    const lookaheadNode = this._lookaheadNode;
    if (lookaheadNode === null) {
      throw new HydrationError(
        `Hydration is failed because there is no node. #text node is expected here.`,
      );
    }
    ensureNode(lookaheadNode, Node.TEXT_NODE, '#text');
    return lookaheadNode.splitText(0);
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
      `Hydration is failed because there is no node. ${expectedName.toLowerCase()} node is expected here.`,
    );
  }

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
