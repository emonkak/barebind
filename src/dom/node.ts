import type { HostNode, VBind, VHostElement } from '../core.js';
import { type DOMPart, ElementPart } from './part.js';

export abstract class DOMNode implements HostNode {
  /** @internal */
  _index: number;

  /** @internal */
  _part: DOMPart | null = null;

  get startNode(): ChildNode | null {
    return null;
  }

  get endNode(): ChildNode | null {
    return null;
  }

  constructor(index: number) {
    this._index = index;
  }

  appendChild(_child: DOMNode, _after: DOMNode | null): void {}

  moveChild(child: DOMNode, after: DOMNode | null): void {
    child._moveBefore(after?.startNode ?? this._part!.node);
  }

  removeChild(child: DOMNode): void {
    child._part = null;
    child._remove();
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

  afterCommit(): void {}

  beforeRemove(): void {}

  /**
   * @internal
   */
  _mountBefore(_afterNode: ChildNode): void {}

  /**
   * @internal
   */
  _mountInto(_parentNode: ParentNode, _afterNode: ChildNode | null): void {}

  /**
   * @internal
   */
  _moveBefore(_afterNode: ChildNode): void {}

  /**
   * @internal
   */
  _moveInto(_parentNode: ParentNode, _afterNode: ChildNode | null): void {}

  /**
   * @internal
   */
  _remove(): void {}
}

export class BindNode extends DOMNode {
  override get startNode(): ChildNode | null {
    return this._part?.node ?? null;
  }

  override get endNode(): ChildNode | null {
    return this._part?.node ?? null;
  }

  override commitMount(_type: VBind['type'], props: VBind['props']): void {
    this._part!.value = props.value;
  }

  override commitUpdate(
    _type: VBind['type'],
    _oldProps: VBind['props'],
    newProps: VBind['props'],
  ): void {
    this._part!.value = newProps.value;
  }
}

export class BlockNode extends DOMNode {
  private readonly _fragment: DocumentFragment;

  private readonly _staticNodes: ChildNode[];

  /** @internal */
  readonly _parts: DOMPart[];

  constructor(index: number, fragment: DocumentFragment, parts: DOMPart[]) {
    super(index);
    this._fragment = fragment;
    this._staticNodes = Array.from(fragment.childNodes);
    this._parts = parts;
  }

  override get startNode(): ChildNode | null {
    return this._staticNodes[0] ?? null;
  }

  override get endNode(): ChildNode | null {
    return this._staticNodes.at(-1) ?? null;
  }

  override appendChild(child: DOMNode, after: DOMNode | null): void {
    const part = this._parts[child._index]!;
    child._mountBefore(after?.startNode ?? part.node);
    child._part = part;
  }

  override moveChild(child: DOMNode, after: DOMNode | null): void {
    const part = this._parts[child._index]!;
    child._moveBefore(after?.startNode ?? part.node);
  }

  override afterCommit(): void {
    for (const part of this._parts) {
      part.afterCommit();
    }
  }

  override beforeRemove(): void {
    for (const part of this._parts) {
      part.beforeRemove();
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
  override _mountInto(
    parentNode: ParentNode,
    afterNode: ChildNode | null,
  ): void {
    parentNode.insertBefore(this._fragment, afterNode);
  }

  /**
   * @internal
   */
  override _moveBefore(afterNode: ChildNode | null): void {
    for (const node of collectChildNodes(this.startNode, this.endNode)) {
      node.parentNode!.moveBefore(node, afterNode);
    }
  }

  /**
   * @internal
   */
  override _moveInto(
    parentNode: ParentNode,
    afterNode: ChildNode | null,
  ): void {
    for (const node of collectChildNodes(this.startNode, this.endNode)) {
      parentNode.moveBefore(node, afterNode);
    }
  }

  /**
   * @internal
   */
  override _remove(): void {
    for (const node of collectChildNodes(this.startNode, this.endNode)) {
      node.remove();
    }
    this._fragment.replaceChildren(...this._staticNodes);
  }
}

export class PortalNode extends DOMNode {
  private readonly _container: Element;

  private readonly _markerNode: Comment;

  constructor(index: number, container: Element) {
    super(index);
    this._container = container;
    this._markerNode = container.ownerDocument.createComment('');
  }

  override get startNode(): ChildNode | null {
    return this._markerNode;
  }

  override get endNode(): ChildNode | null {
    return this._markerNode;
  }

  override appendChild(child: DOMNode, after: DOMNode | null): void {
    child._mountInto(this._container, after?.startNode ?? null);
    child._part = new ElementPart(this._container);
  }

  override moveChild(child: DOMNode, after: DOMNode | null): void {
    child._moveInto(this._container, after?.startNode ?? null);
  }

  /**
   * @internal
   */
  override _mountBefore(afterNode: ChildNode): void {
    afterNode.before(this._markerNode);
  }

  /**
   * @internal
   */
  override _mountInto(
    parentNode: ParentNode,
    afterNode: ChildNode | null,
  ): void {
    parentNode.insertBefore(this._markerNode, afterNode);
  }

  /**
   * @internal
   */
  override _remove(): void {
    this._markerNode.remove();
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
