import { inspectNode } from './debug.js';

const ERROR_MAKER = '[[ERROR IN HERE!]]';

export class HydrationTree {
  private readonly _treeWalker: TreeWalker;

  constructor(root: Node) {
    this._treeWalker = root.ownerDocument!.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
  }

  peekNode(): Node {
    const currentNode = this._treeWalker.currentNode;
    const nextNode = this._treeWalker.nextNode();
    this._treeWalker.currentNode = currentNode;
    if (nextNode === null) {
      throw new Error('Hydration is failed because there is no node.');
    }
    return nextNode as ChildNode;
  }

  popNode(): ChildNode {
    const node = this._treeWalker.nextNode();
    if (node === null) {
      throw new Error('Hydration is failed because there is no node.');
    }
    return node as ChildNode;
  }
}

function isComment(node: Node): node is Comment {
  return node.nodeType === Node.COMMENT_NODE;
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function isText(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}

export function ensureComment(node: Node): Comment {
  if (!isComment(node)) {
    throw new Error(
      'Hydration is failed because the node is mismatched. A comment node is expected here:\n' +
        inspectNode(node, ERROR_MAKER),
    );
  }
  return node;
}

export function ensureElement(node: Node, expectedType: string): Element {
  if (!isElement(node) || node.tagName !== expectedType) {
    throw new Error(
      `Hydration is failed because the node is mismatched. <${expectedType}> is expected here:\n` +
        inspectNode(node, ERROR_MAKER),
    );
  }
  return node;
}

export function ensureText(node: Node): Text {
  if (!isText(node)) {
    throw new Error(
      'Hydration is failed because the node is mismatched. A text node is expected here:\n' +
        inspectNode(node, ERROR_MAKER),
    );
  }
  return node;
}
