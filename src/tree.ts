import {
  Fragment,
  type HostNode,
  MUTATION_TYPE_INSERT,
  MUTATION_TYPE_REMOVE,
  MUTATION_TYPE_UPDATE,
  MUTATION_TYPE_UPDATE_AND_MOVE,
  type RenderNode,
} from './core.js';

export function mount(root: RenderNode.NativeNode): void {
  const { hostNode } = root.state;
  for (const child of root.children) {
    appendChild(hostNode, child, null);
  }
  hostNode.commitMount(root.type, root.props);
  afterCommit(root);
}

export function unmount(root: RenderNode.NativeNode): void {
  beforeRemove(root);
  for (const child of root.children) {
    removeChild(root.state.hostNode, child);
  }
}

export function patch(oldNode: RenderNode, newNode: RenderNode) {
  applyPatch(oldNode, newNode);
  afterCommit(newNode);
  reparent(newNode);
}

function afterCommit(node: RenderNode): void {
  for (const descendant of node.children) {
    afterCommit(descendant);
  }

  if (typeof node.type === 'function') {
    node.state.handle.connect(node);
  } else if (typeof node.type === 'object') {
    node.state.hostNode.afterCommit();
  }
}

function appendChild(
  parentNode: HostNode,
  node: RenderNode,
  afterNode: HostNode | null,
): void {
  if (isInternalNode(node)) {
    for (const descendant of node.children) {
      appendChild(parentNode, descendant, afterNode);
    }
  } else {
    const { hostNode } = node.state;
    for (const descendant of node.children) {
      appendChild(hostNode, descendant, null);
    }
    parentNode.appendChild(hostNode, afterNode);
    hostNode.commitMount(node.type, node.props);
  }
}

function applyPatch(oldNode: RenderNode, newNode: RenderNode): void {
  if (oldNode.id === newNode.id) {
    return;
  }
  if (oldNode.type !== newNode.type || oldNode.key !== newNode.key) {
    removeSubtree(getHostAncestor(oldNode), oldNode);
    appendChild(getHostAncestor(newNode), newNode, getHostSibling(oldNode));
  } else if (typeof newNode.type === 'function') {
    applyPatch(oldNode.children[0]!, newNode.children[0]!);
  } else if (newNode.type === Fragment) {
    const parentNode = getHostAncestor(newNode);

    for (const mutation of newNode.state.mutations.splice(0)) {
      switch (mutation.type) {
        case MUTATION_TYPE_INSERT:
          appendChild(
            parentNode,
            mutation.node,
            mutation.afterNode !== undefined
              ? getHostDescendant(mutation.afterNode)
              : null,
          );
          break;
        case MUTATION_TYPE_UPDATE:
          applyPatch(mutation.oldNode, mutation.newNode);
          break;
        case MUTATION_TYPE_UPDATE_AND_MOVE:
          moveChild(
            parentNode,
            mutation.newNode,
            mutation.afterNode !== undefined
              ? getHostDescendant(mutation.afterNode)
              : null,
          );
          applyPatch(mutation.oldNode, mutation.newNode);
          break;
        case MUTATION_TYPE_REMOVE:
          removeSubtree(parentNode, mutation.node);
          break;
      }
    }
  } else {
    const oldChildren = oldNode.children;
    const newChildren = newNode.children;

    for (let i = 0, l = newChildren.length; i < l; i++) {
      applyPatch(oldChildren[i]!, newChildren[i]!);
    }

    newNode.state.hostNode.commitUpdate(
      newNode.type,
      (oldNode as RenderNode.NativeNode).props,
      newNode.props,
    );
  }
}

function beforeRemove(node: RenderNode): void {
  if (typeof node.type === 'function') {
    node.state.handle.disconnect();
  } else if (typeof node.type === 'object') {
    node.state.hostNode.beforeRemove();
  }
  for (const child of node.children) {
    beforeRemove(child);
  }
}

function getHostAncestor(node: RenderNode): HostNode {
  let current = node.parent;
  while (current !== null) {
    if (!isInternalNode(current)) {
      return current.state.hostNode;
    }
    current = current.parent;
  }
  /** v8 ignore next @preserve */
  DEBUG: {
    throw new Error(
      'Failed to find a host ancestor. This error is likely caused by a bug.',
    );
  }
}

function getHostDescendant(node: RenderNode): HostNode | null {
  if (!isInternalNode(node)) {
    return node.state.hostNode;
  }
  for (const child of node.children) {
    const hostNode = getHostDescendant(child);
    if (hostNode !== null) {
      return hostNode;
    }
  }
  return getHostSibling(node);
}

function getHostSibling(child: RenderNode): HostNode | null {
  while (child.parent !== null) {
    const children = child.parent.children;
    for (let i = child.index + 1, l = children.length; i < l; i++) {
      const hostNode = getHostDescendant(children[i]!);
      if (hostNode !== null) {
        return hostNode;
      }
    }
    child = child.parent;
  }
  return null;
}

function isInternalNode(
  node: RenderNode,
): node is RenderNode.ComponentNode | RenderNode.FragmentNode {
  return typeof node.type === 'function' || node.type === Fragment;
}

function moveChild(
  parentNode: HostNode,
  child: RenderNode,
  afterNode: HostNode | null,
): void {
  if (isInternalNode(child)) {
    for (const descendant of child.children) {
      moveChild(parentNode, descendant, afterNode);
    }
  } else {
    parentNode.moveChild(child.state.hostNode, afterNode);
  }
}

function removeChild(parentNode: HostNode, child: RenderNode): void {
  if (isInternalNode(child)) {
    for (const descendant of child.children) {
      removeChild(parentNode, descendant);
    }
  } else {
    parentNode.removeChild(child.state.hostNode);
    for (const descendant of child.children) {
      removeChild(child.state.hostNode, descendant);
    }
  }
}

function removeSubtree(parentNode: HostNode, child: RenderNode): void {
  beforeRemove(child);
  removeChild(parentNode, child);
}

function reparent(node: RenderNode): void {
  if (node.parent !== null) {
    node.parent.children[node.index] = node;
  }
}
