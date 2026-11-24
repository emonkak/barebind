import {
  Bind,
  type HostNode,
  MutationType,
  type RenderNode,
} from './abstractions.js';

export function mount(node: RenderNode): void {
  mountChild(node, null);
  afterCommit(node);
}

export function unmount(node: RenderNode): void {
  unmountChild(node);
}

export function patch(oldNode: RenderNode, newNode: RenderNode) {
  applyPatch(oldNode, newNode, newNode.index, newNode.parent);
  afterCommit(newNode);
}

function afterCommit(node: RenderNode): void {
  if (!isCommitted(node)) {
    for (const child of node.left) {
      afterCommit(child);
    }
    if (typeof node.type === 'function') {
      node.state.renderer.afterCommit();
    }
    node.right = node.left;
  }
}

function applyPatch(
  oldNode: RenderNode,
  newNode: RenderNode,
  index: number,
  parent: RenderNode | null,
): void {
  if (oldNode === newNode && isCommitted(oldNode)) {
    reparentChild(oldNode, index, parent);
    return;
  }
  if (oldNode.type !== newNode.type || oldNode.key !== newNode.key) {
    unmountChild(oldNode);
    mountChild(newNode, getSiblingHostNode(newNode));
  } else if (newNode.type === Bind) {
    newNode.part.commitUpdate(
      (oldNode as RenderNode.BindNode).props.value,
      newNode.props.value,
    );
  } else if (typeof newNode.type === 'object') {
    const oldChildren = newNode.right;
    const newChildren = newNode.left;
    for (let i = 0, l = newChildren.length; i < l; i++) {
      applyPatch(oldChildren[i]!, newChildren[i]!, i, newNode);
    }
  } else if (typeof newNode.type === 'function') {
    applyPatch(newNode.right[0]!, newNode.left[0]!, 0, newNode);
  } else {
    for (const mutation of newNode.state.mutations.splice(0)) {
      switch (mutation.type) {
        case MutationType.INSERT:
          mountChild(
            mutation.node,
            mutation.afterNode !== undefined
              ? getChildHostNode(mutation.afterNode)
              : null,
          );
          break;
        case MutationType.UPDATE:
          applyPatch(
            mutation.oldNode,
            mutation.newNode,
            mutation.index,
            newNode,
          );
          break;
        case MutationType.UPDATE_AND_MOVE:
          applyPatch(
            mutation.oldNode,
            mutation.newNode,
            mutation.index,
            newNode,
          );
          moveChild(
            mutation.newNode,
            mutation.afterNode !== undefined
              ? getChildHostNode(mutation.afterNode)
              : null,
          );
          break;
        case MutationType.REMOVE:
          unmountChild(mutation.node);
          break;
      }
    }
  }
}

function getChildHostNode(node: RenderNode): HostNode | null {
  if (typeof node.type === 'object') {
    return node.state.block.hostNodes[0]!;
  }
  for (const child of node.left) {
    const hostNode = getChildHostNode(child);
    if (hostNode !== null) {
      return hostNode;
    }
  }
  return getSiblingHostNode(node);
}

function getSiblingHostNode(node: RenderNode): HostNode | null {
  const ownPart = node.part;
  // A null parent means either the node is detached or it is the root node.
  while (node.parent !== null) {
    const parent = node.parent;
    const children = isCommitted(node) ? parent.right : parent.left;
    for (let i = node.index + 1, l = children.length; i < l; i++) {
      const child = children[i]!;
      if (child.part !== ownPart) {
        break;
      }
      const hostNode = getChildHostNode(child);
      if (hostNode !== null) {
        return hostNode;
      }
    }
    node = parent;
  }
  return null;
}

function isCommitted(node: RenderNode): boolean {
  return node.left === node.right;
}

function mountChild(child: RenderNode, afterNode: HostNode | null): void {
  if (child.type === Bind) {
    child.part.commitMount(child.props.value);
  } else if (typeof child.type === 'object') {
    for (const grandchild of child.left) {
      mountChild(grandchild, null);
    }
    child.part.mountBlock(child.state.block, afterNode);
  } else {
    for (const grandchild of child.left) {
      mountChild(grandchild, afterNode);
    }
  }
}

function moveChild(child: RenderNode, afterNode: HostNode | null): void {
  if (typeof child.type === 'object') {
    child.part.moveBlock(child.state.block, afterNode);
  } else {
    for (const grandchild of child.left) {
      moveChild(grandchild, afterNode);
    }
  }
}

function reparentChild(
  child: RenderNode,
  index: number,
  parent: RenderNode | null,
): void {
  child.index = index;
  child.parent = parent;
}

function unmountChild(child: RenderNode, cascade: boolean = false): void {
  if (child.type === Bind) {
    child.part.commitUnmount(child.props.value, cascade);
  } else if (typeof child.type === 'object') {
    child.part.unmountBlock(child.state.block, cascade);
    for (const grandchild of child.right) {
      unmountChild(grandchild, true);
    }
  } else {
    if (typeof child.type === 'function') {
      child.state.renderer.beforeUnmount();
    }
    for (const grandchild of child.right) {
      unmountChild(grandchild, cascade);
    }
  }
  child.index = -1;
  child.parent = null;
}
