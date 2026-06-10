import type { HostNode, VHostElement, VPrimitive } from '../core.js';
import type { DOMPart } from './part.js';

const insertBefore = Element.prototype.insertBefore;
const moveBefore =
  /* v8 ignore next */
  Element.prototype.moveBefore ?? Element.prototype.insertBefore;

export abstract class DOMNode implements HostNode {
  /** @internal */
  _parent: DOMNode | null = null;
  /** @internal */
  _children: Set<DOMNode> = new Set();

  get firstNode(): ChildNode | null {
    return null;
  }

  get lastNode(): ChildNode | null {
    return null;
  }

  get value(): unknown {
    return null;
  }

  appendChild(child: DOMNode, _after: DOMNode | null): void {
    this._children.add(child);
    child._parent = this;
  }

  commitMount(
    _type: VHostElement['type'],
    _props: VHostElement['props'],
  ): void {}

  commitUpdate(
    _type: VHostElement['type'],
    _oldProps: VHostElement['props'],
    _newProps: VHostElement['props'],
  ): void {}

  moveChild(_child: DOMNode, _after: DOMNode | null): void {}

  removeChild(child: DOMNode): void {
    this._children.delete(child);
    child._beforeRemove();
    child._removeSubtree();
    child._parent = null;
  }

  /**
   * @internal
   */
  _beforeRemove(): void {
    for (const child of this._children) {
      child._beforeRemove();
    }
  }

  /**
   * @internal
   */
  _invalidate(_child: DOMNode): void {}

  /**
   * @internal
   */
  _mountBefore(_afterNode: ChildNode): void {}

  /**
   * @internal
   */
  _moveBefore(_afterNode: ChildNode): void {}

  /**
   * @internal
   */
  _remove(): void {
    for (const child of this._children) {
      child._remove();
    }
  }

  /**
   * @internal
   */
  _removeSubtree(): void {
    for (const child of this._children) {
      child._remove();
    }
  }
}

export class BindNode extends DOMNode {
  private readonly _index: number;

  constructor(index: number) {
    super();
    this._index = index;
  }

  get index(): number {
    return this._index;
  }

  override appendChild(child: DOMNode, after: DOMNode | null): void {
    super.appendChild(child, after);
    const part = this._getPart();
    if (part !== undefined) {
      child._mountBefore(after?.firstNode ?? part.node);
      part.value = child.value;
    }
  }

  override moveChild(child: DOMNode, after: DOMNode | null): void {
    const part = this._getPart();
    if (part !== undefined) {
      child._moveBefore(after?.firstNode ?? part.node);
    }
  }

  /**
   * @internal
   */
  override _invalidate(child: DOMNode): void {
    const part = this._getPart();
    if (part !== undefined) {
      part.value = child.value;
    }
  }

  private _getPart(): DOMPart | undefined {
    return this._parent instanceof BlockNode
      ? this._parent._parts[this._index]
      : undefined;
  }
}

export class BlockNode extends DOMNode {
  readonly _fragment: DocumentFragment;

  readonly _staticNodes: ChildNode[];

  readonly _parts: DOMPart[];

  constructor(fragment: DocumentFragment, parts: DOMPart[]) {
    super();
    this._fragment = fragment;
    this._staticNodes = Array.from(fragment.childNodes);
    this._parts = parts;
  }

  override get firstNode(): ChildNode | null {
    return this._staticNodes[0] ?? null;
  }

  override get lastNode(): ChildNode | null {
    return this._staticNodes.at(-1) ?? null;
  }

  override commitMount(
    _type: VHostElement['type'],
    _props: VHostElement['props'],
  ): void {
    for (const child of this._children) {
      const part = this._parts[(child as BindNode).index];
      if (part !== undefined) {
        for (const descendant of child._children) {
          descendant._mountBefore(part.node);
          part.value = descendant.value;
        }
      }
    }
    for (const child of this._children) {
      this._parts[(child as BindNode).index]?.afterCommit();
    }
  }

  /**
   * @internal
   */
  override _beforeRemove(): void {
    for (const child of this._children) {
      this._parts[(child as BindNode).index]?.beforeRemove();
      child._beforeRemove();
    }
  }

  /**
   * @internal
   */
  override _mountBefore(afterNode: ChildNode): void {
    afterNode.before(this._fragment);
  }

  /**
   * @internal
   */
  override _moveBefore(afterNode: ChildNode): void {
    for (const node of collectChildNodes(this.firstNode, this.lastNode)) {
      moveBefore.call(afterNode.parentNode, node, afterNode);
    }
  }

  /**
   * @internal
   */
  override _removeSubtree(): void {
    super._removeSubtree();
    for (const node of collectChildNodes(this.firstNode, this.lastNode)) {
      node.remove();
    }
    this._fragment.replaceChildren(...this._staticNodes);
  }
}

export class PortalNode extends DOMNode {
  private _container: Element;

  constructor(container: Element) {
    super();
    this._container = container;
  }

  override appendChild(child: DOMNode, after: DOMNode | null): void {
    super.appendChild(child, after);
    for (const node of collectChildNodes(child.firstNode, child.lastNode)) {
      insertBefore.call(this._container, node, after?.firstNode ?? null);
    }
  }

  override moveChild(child: DOMNode, after: DOMNode | null): void {
    for (const node of collectChildNodes(child.firstNode, child.lastNode)) {
      moveBefore.call(this._container, node, after?.firstNode ?? null);
    }
  }

  /**
   * @internal
   */
  override _remove(): void {
    for (const child of this._children) {
      child._removeSubtree();
    }
  }

  /**
   * @internal
   */
  override _removeSubtree(): void {
    for (const child of this._children) {
      child._removeSubtree();
    }
    this._marker.remove();
  }
}

export class PrimitiveNode extends DOMNode {
  private _value: unknown;

  constructor(value: unknown) {
    super();
    this._value = value;
  }

  override get value(): unknown {
    return this._value;
  }

  override commitUpdate(
    _type: VPrimitive['type'],
    _oldProps: VPrimitive['props'],
    newProps: VPrimitive['props'],
  ): void {
    this._value = newProps.value;
    this._parent?._invalidate(this);
  }
}

function collectChildNodes(
  firstNode: ChildNode | null,
  lastNode: ChildNode | null,
): ChildNode[] {
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
