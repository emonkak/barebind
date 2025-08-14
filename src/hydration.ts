import { HydrationError, type HydrationTree } from './core.js';
import { debugNode } from './debug/node.js';

interface NodeTypeMap {
  [Node.COMMENT_NODE]: Comment;
  [Node.ELEMENT_NODE]: Element;
  [Node.TEXT_NODE]: Text;
}

export function createHydrationTree(container: Element): HydrationTree {
  return container.ownerDocument.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
}

export function replaceMarkerNode(
  tree: HydrationTree,
  markerNode: Comment,
): void {
  treatNodeType(Node.COMMENT_NODE, tree.nextNode(), tree).replaceWith(
    markerNode,
  );
  tree.currentNode = markerNode;
}

export function splitText(tree: HydrationTree): Text {
  const previousNode = tree.currentNode;
  const currentNode = tree.nextNode();

  if (
    previousNode instanceof Text &&
    (currentNode === null || currentNode.previousSibling === previousNode)
  ) {
    const splittedText = previousNode.ownerDocument.createTextNode('');
    previousNode.after(splittedText);
    tree.currentNode = splittedText;
    return splittedText;
  } else {
    return treatNodeType(Node.TEXT_NODE, currentNode, tree);
  }
}

export function treatNodeName(
  expectedName: string,
  node: Node | null,
  tree: HydrationTree,
): Node {
  if (node === null || node.nodeName !== expectedName) {
    throw new HydrationError(
      `Hydration is failed because the node type is mismatched. ${expectedName} is expected here, but got ${node?.nodeName ?? 'null'}:\n` +
        debugNode(tree.currentNode, '[[MISMATCH IN HERE!]]'),
    );
  }

  return node;
}

export function treatNodeType<TExpectedType extends keyof NodeTypeMap>(
  expectedType: TExpectedType,
  node: Node | null,
  tree: HydrationTree,
): NodeTypeMap[TExpectedType] {
  if (node === null || node.nodeType !== expectedType) {
    throw new HydrationError(
      `Hydration is failed because the node type is mismatched. ${expectedType} is expected here, but got ${node?.nodeType ?? 'null'}:\n` +
        debugNode(tree.currentNode, '[[MISMATCH IN HERE!]]'),
    );
  }

  return node as NodeTypeMap[TExpectedType];
}
