import {
  Directive,
  Fragment,
  type HostNode,
  type HostTree,
  InsertType,
  RemoveType,
  type RenderRoot,
  type RenderTree,
  UpdateAndMoveType,
  UpdateType,
} from './core.js';
import { NoLanes } from './lane.js';

export function mount(tree: RenderRoot): void {
  for (const child of tree.children) {
    appendChild(tree.hostNode, child, null);
  }
  tree.hostNode.commitMount(tree.type, tree.props);
  afterCommit(tree);
}

export function unmount(tree: RenderRoot): void {
  beforeRemove(tree);
  for (const child of tree.children) {
    removeSubtree(tree.hostNode, child);
  }
}

export function patch(oldTree: RenderTree, newTree: RenderTree) {
  applyPatch(oldTree, newTree);
  afterCommit(newTree);
}

function afterCommit(tree: RenderTree): void {
  if (typeof tree.type === 'function') {
    tree.instance.afterCommit();
  } else if (tree.type === Directive) {
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
}

function appendChild(
  parentNode: HostNode,
  child: RenderTree,
  afterNode: HostNode | null,
): void {
  if (isHostTree(child)) {
    parentNode.appendChild(child.hostNode, afterNode);
    for (const descendant of child.children) {
      appendChild(child.hostNode, descendant, null);
    }
    child.hostNode.commitMount(child.type, child.props);
  } else {
    for (const descendant of child.children) {
      appendChild(parentNode, descendant, afterNode);
    }
  }
}

function applyPatch(oldTree: RenderTree, newTree: RenderTree): void {
  if (oldTree === newTree) {
    return;
  }
  if (oldTree.type !== newTree.type || oldTree.key !== newTree.key) {
    removeChild(getHostAncestor(oldTree), oldTree);
    appendChild(getHostAncestor(newTree), newTree, nextHostSibling(oldTree));
  } else if (typeof newTree.type === 'function') {
    applyPatch(oldTree.children[0]!, newTree.children[0]!);
  } else if (newTree.type === Directive) {
    // skip
  } else if (newTree.type === Fragment) {
    const parentNode = getHostAncestor(newTree.parent);

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
          removeChild(parentNode, mutation.tree);
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
      (oldTree as HostTree).props,
      newTree.props,
    );
  }
  if (newTree.parent !== null) {
    newTree.parent.children[newTree.index] = newTree;
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
    if (isHostTree(tree.parent)) {
      return tree.parent.hostNode;
    }
    tree = tree.parent;
  }
  return tree.hostNode;
}

function getHostDescendant(tree: RenderTree): HostNode | null {
  if (isHostTree(tree)) {
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

function isHostTree(tree: RenderTree): tree is HostTree {
  return typeof tree.type !== 'function' && tree.type !== Fragment;
}

function moveChild(
  parentNode: HostNode,
  child: RenderTree,
  afterNode: HostNode | null,
): void {
  if (isHostTree(child)) {
    parentNode.moveChild(child.hostNode, afterNode);
  } else {
    for (const descendant of child.children) {
      moveChild(parentNode, descendant, afterNode);
    }
  }
}

function nextHostSibling(child: RenderTree): HostNode | null {
  while (child.parent !== null && !isHostTree(child.parent)) {
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
  beforeRemove(child);
  removeSubtree(parentNode, child);
}

function removeSubtree(parentNode: HostNode, child: RenderTree): void {
  if (isHostTree(child)) {
    parentNode.removeChild(child.hostNode);
  } else {
    for (const descendant of child.children) {
      removeSubtree(parentNode, descendant);
    }
  }
}
