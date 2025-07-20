import type { NodeScanner } from './core.js';
import { debugNode } from './debug.js';

export class HydrationNodeScanner implements NodeScanner {
  private readonly _treeWalker: TreeWalker;

  private _lookaheadNode: Node | null;

  constructor(container: Element) {
    this._treeWalker = container.ownerDocument.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
    this._lookaheadNode = this._treeWalker.nextNode();
  }

  nextNode(expectedName: string): ChildNode {
    const lookaheadNode = this._lookaheadNode;
    ensureNode(expectedName, lookaheadNode, this._treeWalker.currentNode);
    this._lookaheadNode = this._treeWalker.nextNode();
    return lookaheadNode;
  }

  peekNode(expectedName: string): ChildNode {
    const lookaheadNode = this._lookaheadNode;
    ensureNode(expectedName, lookaheadNode, this._treeWalker.currentNode);
    return lookaheadNode;
  }

  splitText(): this {
    const currentNode = this._treeWalker.currentNode;
    const lookaheadNode = this._lookaheadNode;

    if (
      currentNode instanceof Text &&
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

function ensureNode<TName extends string>(
  expectedName: TName,
  actualNode: Node | null,
  lastNode: Node,
): asserts actualNode is ChildNode {
  if (actualNode === null) {
    throw new HydrationError(
      `Hydration is failed because there is no node. ${expectedName} node is expected here:\n` +
        debugNode(lastNode, '[[THIS IS THE LAST NODE!]]'),
    );
  }

  if (actualNode.nodeName !== expectedName) {
    throw new HydrationError(
      `Hydration is failed because the node is mismatched. ${expectedName} node is expected here:\n` +
        debugNode(lastNode, '[[THIS IS MISMATCHED!]]'),
    );
  }
}
