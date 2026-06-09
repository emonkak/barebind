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
  for (const child of root.children) {
    appendChild(root.data, child, null);
  }
  root.data.commitMount(root.type, root.props);
  afterCommit(root);
}

export function unmount(root: RenderNode.NativeNode): void {
  beforeRemove(root);
  for (const child of root.children) {
    removeChild(root.data, child);
  }
}

export function patch(oldView: RenderNode, newView: RenderNode) {
  applyPatch(oldView, newView);
  afterCommit(newView);
  reparent(newView);
}

function afterCommit(node: RenderNode): void {
  for (const descendant of node.children) {
    afterCommit(descendant);
  }

  if (typeof node.type === 'function') {
    node.data.afterCommit(node);
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
    for (const descendant of node.children) {
      appendChild(node.data, descendant, null);
    }
    parentNode.appendChild(node.data, afterNode);
    node.data.commitMount(node.type, node.props);
  }
}

function applyPatch(oldView: RenderNode, newView: RenderNode): void {
  if (oldView.id === newView.id) {
    return;
  }
  if (oldView.type !== newView.type || oldView.key !== newView.key) {
    removeSubtree(getHostAncestor(oldView), oldView);
    appendChild(getHostAncestor(newView), newView, nextHostSibling(oldView));
  } else if (typeof newView.type === 'function') {
    applyPatch(oldView.children[0]!, newView.children[0]!);
  } else if (newView.type === Fragment) {
    const parentNode = getHostAncestor(newView);

    for (const mutation of newView.data) {
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
    const oldChildren = oldView.children;
    const newChildren = newView.children;

    for (let i = 0, l = newChildren.length; i < l; i++) {
      applyPatch(oldChildren[i]!, newChildren[i]!);
    }

    newView.data.commitUpdate(
      newView.type,
      (oldView as RenderNode.NativeNode).props,
      newView.props,
    );
  }
}

function beforeRemove(node: RenderNode): void {
  if (typeof node.type === 'function') {
    node.data.beforeRemove();
  }
  for (const child of node.children) {
    beforeRemove(child);
  }
}

function getHostAncestor(node: RenderNode): HostNode {
  while (node.parent !== null) {
    if (!isInternalNode(node.parent)) {
      return node.parent.data;
    }
    node = node.parent;
  }
  return (node as RenderNode.NativeNode).data;
}

function getHostDescendant(node: RenderNode): HostNode | null {
  if (!isInternalNode(node)) {
    return node.data;
  }
  for (const child of node.children) {
    const hostNode = getHostDescendant(child);
    if (hostNode !== null) {
      return hostNode;
    }
  }
  return nextHostSibling(node);
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
    parentNode.moveChild(child.data, afterNode);
  }
}

function nextHostSibling(child: RenderNode): HostNode | null {
  while (child.parent !== null && !isInternalNode(child.parent)) {
    const parent = child.parent;
    for (let i = child.index + 1, l = parent.children.length; i < l; i++) {
      const hostNode = getHostDescendant(parent.children[i]!);
      if (hostNode !== null) {
        return hostNode;
      }
    }
    child = child.parent;
  }
  return null;
}

function removeChild(parentNode: HostNode, child: RenderNode): void {
  if (isInternalNode(child)) {
    for (const descendant of child.children) {
      removeChild(parentNode, descendant);
    }
  } else {
    parentNode.removeChild(child.data);
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
