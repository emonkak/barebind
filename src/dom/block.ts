import type { Block, HostContainer } from '../base.js';
import { DOMAdapterError } from './error.js';
import type { DOMPart } from './part.js';

const insertBefore = Element.prototype.insertBefore;
const moveBefore = Element.prototype.moveBefore ?? insertBefore;

export class DOMBlock implements Block {
  private readonly _fragment: DocumentFragment;
  private readonly _hostNodes: ChildNode[];
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
    this._hostNodes = Array.from(fragment.childNodes);
    this._parts = parts;
  }

  get parts(): readonly DOMPart[] {
    return this._parts;
  }

  get hostNodes(): readonly ChildNode[] {
    return this._hostNodes;
  }

  mountBefore(afterNode: ChildNode): void {
    afterNode.before(this._fragment);
  }

  mountInto(container: HostContainer, afterNode: ChildNode | null): void {
    insertBefore.call(container, this._fragment, afterNode);
  }

  moveBefore(afterNode: ChildNode): void {
    for (const node of collectChildNodes(this._hostNodes)) {
      moveBefore.call(afterNode.parentNode, node, afterNode);
    }
  }

  moveInto(container: HostContainer, afterNode: ChildNode | null): void {
    for (const node of collectChildNodes(this._hostNodes)) {
      moveBefore.call(container, node, afterNode);
    }
  }

  unmount(): void {
    for (const node of collectChildNodes(this._hostNodes)) {
      node.remove();
    }
  }
}

function collectChildNodes(hostNodes: ChildNode[]): ChildNode[] {
  const firstNode = hostNodes[0] ?? null;
  const lastNode = hostNodes.at(-1) ?? null;
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
