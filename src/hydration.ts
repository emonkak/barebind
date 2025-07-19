import type { HydrationNode, HydrationTree } from './core.js';
import { debugNode } from './debug.js';

export class HydrationContainer implements HydrationTree {
  private readonly _treeWalker: TreeWalker;

  private _lookaheadNode: Node | null;

  constructor(container: Element) {
    this._treeWalker = container.ownerDocument.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
    this._lookaheadNode = this._treeWalker.nextNode();
  }

  peekNode<T extends number>(
    expectedType: T,
    expectedName: string,
  ): HydrationNode<T> {
    const lookaheadNode = this._lookaheadNode;
    ensureNode(
      lookaheadNode,
      expectedType,
      expectedName,
      this._treeWalker.currentNode,
    );
    return lookaheadNode;
  }

  popNode<T extends number>(
    expectedType: T,
    expectedName: string,
  ): HydrationNode<T> {
    const lookaheadNode = this._lookaheadNode;
    ensureNode(
      lookaheadNode,
      expectedType,
      expectedName,
      this._treeWalker.currentNode,
    );
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
  currentNode: Node,
): asserts actualNode is HydrationNode<T> {
  if (actualNode === null) {
    throw new HydrationError(
      `Hydration is failed because there is no node. ${expectedName} node is expected here:\n` +
        debugNode(currentNode, '[[THIS IS THE LAST NODE!]]'),
    );
  }

  if (
    actualNode.nodeType !== expectedType ||
    actualNode.nodeName !== expectedName
  ) {
    throw new HydrationError(
      `Hydration is failed because the node is mismatched. ${expectedName} node is expected here:\n` +
        debugNode(currentNode, '[[THIS IS MISMATCHED!]]'),
    );
  }
}

function narrowNode<T extends number>(
  actualNode: Node,
  expectedType: T,
): actualNode is HydrationNode<T> {
  return actualNode.nodeType === expectedType;
}
