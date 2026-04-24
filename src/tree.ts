import {
  Directive,
  Fragment,
  type HostNode,
  InsertType,
  RemoveType,
  type RenderTree,
  UpdateAndMoveType,
  UpdateType,
} from './core.js';
import { NoLanes } from './lane.js';

export function mount(root: RenderTree.NativeNode): void {
  for (const child of root.children) {
    appendChild(root.hostNode, child, null);
  }
  root.hostNode.commitMount(root.type, root.props);
  afterCommit(root);
}

export function unmount(root: RenderTree.NativeNode): void {
  beforeRemove(root);
  for (const child of root.children) {
    removeChild(root.hostNode, child);
  }
}

export function patch(oldTree: RenderTree, newTree: RenderTree) {
  applyPatch(oldTree, newTree);
  afterCommit(newTree);
  reparent(newTree);
}

function afterCommit(tree: RenderTree): void {
  if (tree.type === Directive) {
    if (tree.dirty) {
      const { setup } = tree.props;
      tree.cleanup?.call(undefined);
      tree.cleanup = setup(getHostAncestor(tree).refInstance);
      tree.dirty = false;
    }
  }

  for (const descendant of tree.children) {
    afterCommit(descendant);
  }

  if (typeof tree.type === 'function') {
    tree.instance.afterCommit();
  }
}

function appendChild(
  parentNode: HostNode,
  tree: RenderTree,
  afterNode: HostNode | null,
): void {
  if (isNativeNode(tree)) {
    for (const descendant of tree.children) {
      appendChild(tree.hostNode, descendant, null);
    }
    parentNode.appendChild(tree.hostNode, afterNode);
    tree.hostNode.commitMount(tree.type, tree.props);
  } else {
    for (const descendant of tree.children) {
      appendChild(parentNode, descendant, afterNode);
    }
  }
}

function applyPatch(oldTree: RenderTree, newTree: RenderTree): void {
  if (oldTree.id === newTree.id) {
    return;
  }
  if (oldTree.type !== newTree.type || oldTree.key !== newTree.key) {
    removeSubtree(getHostAncestor(oldTree), oldTree);
    appendChild(getHostAncestor(newTree), newTree, nextHostSibling(oldTree));
  } else if (typeof newTree.type === 'function') {
    (oldTree as RenderTree.ComponentNode).scope.pendingLanes = NoLanes;
    applyPatch(oldTree.children[0]!, newTree.children[0]!);
  } else if (newTree.type === Directive) {
    // skip
  } else if (newTree.type === Fragment) {
    const parentNode = getHostAncestor(newTree);

    for (const mutation of newTree.mutations) {
      switch (mutation.type) {
        case InsertType:
          appendChild(
            parentNode,
            mutation.tree,
            mutation.afterTree !== undefined
              ? getHostDescendant(mutation.afterTree)
              : null,
          );
          break;
        case UpdateType:
          applyPatch(mutation.oldTree, mutation.newTree);
          break;
        case UpdateAndMoveType:
          moveChild(
            parentNode,
            mutation.newTree,
            mutation.afterTree !== undefined
              ? getHostDescendant(mutation.afterTree)
              : null,
          );
          applyPatch(mutation.oldTree, mutation.newTree);
          break;
        case RemoveType:
          removeSubtree(parentNode, mutation.tree);
          break;
      }
    }
  } else {
    const oldChildren = oldTree.children;
    const newChildren = newTree.children;

    for (let i = 0, l = newChildren.length; i < l; i++) {
      applyPatch(oldChildren[i]!, newChildren[i]!);
    }

    newTree.hostNode.commitUpdate(
      newTree.type,
      (oldTree as RenderTree.NativeNode).props,
      newTree.props,
    );
  }
}

function beforeRemove(tree: RenderTree): void {
  if (typeof tree.type === 'function') {
    tree.instance.beforeRemove();
    tree.scope.pendingLanes = NoLanes;
  } else if (tree.type === Directive) {
    tree.cleanup?.call(undefined);
    tree.cleanup = undefined;
  }

  for (const child of tree.children) {
    beforeRemove(child);
  }
}

function getHostAncestor(tree: RenderTree): HostNode {
  while (tree.parent !== null) {
    if (isNativeNode(tree.parent)) {
      return tree.parent.hostNode;
    }
    tree = tree.parent;
  }
  return (tree as RenderTree.NativeNode).hostNode;
}

function getHostDescendant(tree: RenderTree): HostNode | null {
  if (isNativeNode(tree)) {
    return tree.hostNode;
  }
  for (const child of tree.children) {
    const hostNode = getHostDescendant(child);
    if (hostNode !== null) {
      return hostNode;
    }
  }
  return nextHostSibling(tree);
}

function isNativeNode(tree: RenderTree): tree is RenderTree.NativeNode {
  return (
    typeof tree.type !== 'function' &&
    tree.type !== Directive &&
    tree.type !== Fragment
  );
}

function moveChild(
  parentNode: HostNode,
  child: RenderTree,
  afterNode: HostNode | null,
): void {
  if (isNativeNode(child)) {
    parentNode.moveChild(child.hostNode, afterNode);
  } else {
    for (const descendant of child.children) {
      moveChild(parentNode, descendant, afterNode);
    }
  }
}

function nextHostSibling(child: RenderTree): HostNode | null {
  while (child.parent !== null && !isNativeNode(child.parent)) {
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

function removeChild(parentNode: HostNode, child: RenderTree): void {
  if (isNativeNode(child)) {
    parentNode.removeChild(child.hostNode);
  } else {
    for (const descendant of child.children) {
      removeChild(parentNode, descendant);
    }
  }
}

function removeSubtree(parentNode: HostNode, child: RenderTree): void {
  beforeRemove(child);
  removeChild(parentNode, child);
}

function reparent(tree: RenderTree): void {
  if (tree.parent !== null) {
    tree.parent.children[tree.index] = tree;
  }
}
