import type { Block, Container } from '../core.js';
import { DOMAdapterError } from './error.js';
import type { DOMPart } from './part.js';

const insertBefore = Element.prototype.insertBefore;
const moveBefore = Element.prototype.moveBefore ?? insertBefore;

export class DOMBlock implements Block {
  private readonly _fragment: DocumentFragment;
  private readonly _staticNodes: ChildNode[];
  private readonly _parts: DOMPart[];

  constructor(fragment: DocumentFragment, parts: DOMPart[]) {
    DEBUG: {
      if (fragment.childNodes.length === 0) {
        throw new DOMAdapterError(
          'DOMBlock must have at least one child node.',
        );
      }
    }
    this._fragment = fragment;
    this._staticNodes = Array.from(fragment.childNodes);
    this._parts = parts;
  }

  get parts(): readonly DOMPart[] {
    return this._parts;
  }

  get staticNodes(): readonly ChildNode[] {
    return this._staticNodes;
  }

  mountBefore(afterNode: ChildNode): void {
    afterNode.before(this._fragment);
  }

  mountInto(container: Container, afterNode: ChildNode | null): void {
    insertBefore.call(container, this._fragment, afterNode);
  }

  moveBefore(afterNode: ChildNode): void {
    for (const node of collectChildNodes(this._staticNodes)) {
      moveBefore.call(afterNode.parentNode, node, afterNode);
    }
  }

  moveInto(container: Container, afterNode: ChildNode | null): void {
    for (const node of collectChildNodes(this._staticNodes)) {
      moveBefore.call(container, node, afterNode);
    }
  }

  unmount(): void {
    for (const node of collectChildNodes(this._staticNodes)) {
      node.remove();
    }
  }
}

function collectChildNodes(staticNodes: ChildNode[]): ChildNode[] {
  const firstNode = staticNodes[0] ?? null;
  const lastNode = staticNodes.at(-1) ?? null;
  const childNodes = [];

  for (
    let currentNode = firstNode;
    currentNode !== null;
    currentNode = currentNode.nextSibling
  ) {
    childNodes.push(currentNode);
    if (currentNode === lastNode) {
      break;
    }
  }

  return childNodes;
}
