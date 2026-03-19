import { BOUNDARY_TYPE_HYDRATION, type Scope } from './core.js';
import { emphasizeNode } from './debug/node.js';

interface NodeTypeMap {
  [Node.COMMENT_NODE]: Comment;
  [Node.ELEMENT_NODE]: Element;
  [Node.TEXT_NODE]: Text;
}

export class HydrationError extends Error {
  readonly target: TreeWalker;

  constructor(target: TreeWalker, message: string) {
    DEBUG: {
      message += '\n' + emphasizeNode(target.currentNode, '[[ERROR IN HERE!]]');
    }

    super(message);

    this.target = target;
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

export function getHydrationTarget(scope: Scope): TreeWalker | null {
  for (
    let boundary = scope.boundary;
    boundary !== null;
    boundary = boundary.next
  ) {
    if (boundary.type === BOUNDARY_TYPE_HYDRATION) {
      return boundary.target;
    }
  }
  return null;
}

export function replaceMarkerNode(
  target: TreeWalker,
  markerNode: Comment,
): void {
  treatNodeType(Node.COMMENT_NODE, target.nextNode(), target).replaceWith(
    markerNode,
  );
  target.currentNode = markerNode;
}

export function splitText(target: TreeWalker): Text {
  const previousNode = target.currentNode;
  const currentNode = target.nextNode();

  if (
    previousNode instanceof Text &&
    (currentNode === null || currentNode.previousSibling === previousNode)
  ) {
    const splittedText = previousNode.ownerDocument.createTextNode('');
    previousNode.after(splittedText);
    target.currentNode = splittedText;
    return splittedText;
  } else {
    return treatNodeType(Node.TEXT_NODE, currentNode, target);
  }
}

export function treatNodeName(
  expectedName: string,
  node: Node | null,
  target: TreeWalker,
): Node {
  if (node === null || node.nodeName !== expectedName) {
    throw new HydrationError(
      target,
      `Hydration is failed because the node name is mismatched. ${expectedName} is expected here, but got ${node?.nodeName}.`,
    );
  }

  return node;
}

export function treatNodeType<TExpectedType extends keyof NodeTypeMap>(
  expectedType: TExpectedType,
  node: Node | null,
  target: TreeWalker,
): NodeTypeMap[TExpectedType] {
  if (node === null || node.nodeType !== expectedType) {
    throw new HydrationError(
      target,
      `Hydration is failed because the node type is mismatched. ${expectedType} is expected here, but got ${node?.nodeType}.`,
    );
  }

  return node as NodeTypeMap[TExpectedType];
}
