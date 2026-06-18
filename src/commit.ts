import {
  Fragment,
  MUTATION_TYPE_INSERT,
  MUTATION_TYPE_REMOVE,
  MUTATION_TYPE_UPDATE,
  MUTATION_TYPE_UPDATE_AND_MOVE,
  type RenderNode,
  type RenderRoot,
  Root,
} from './core.js';

export function mount(node: RenderNode): void {
  mountChild(node, null);
  afterCommit(node);
  replaceChild(node);
}

export function unmount(node: RenderNode): void {
  beforeRemove(node);
  unmountChild(node);
}

export function patch(oldNode: RenderNode, newNode: RenderNode) {
  applyPatch(oldNode, newNode, newNode.parent);
  afterCommit(newNode);
  replaceChild(newNode);
}

function afterCommit(node: RenderNode): void {
  if (node.dirty) {
    for (const child of node.children) {
      afterCommit(child);
    }
    if (typeof node.type === 'function') {
      node.state.handle.connect(node);
    }
    node.dirty = false;
  }
}

function applyPatch(
  oldNode: RenderNode,
  newNode: RenderNode,
  parent: RenderNode | RenderRoot,
): void {
  if (oldNode === newNode) {
    reparentChild(newNode, parent);
    return;
  }
  if (oldNode.type !== newNode.type || oldNode.key !== newNode.key) {
    unmountChild(oldNode);
    mountChild(newNode, getHostSibling(oldNode));
  } else if (typeof newNode.type === 'function') {
    applyPatch(oldNode.children[0]!, newNode.children[0]!, newNode);
  } else if (newNode.type === Fragment) {
    for (const mutation of newNode.state.mutations.splice(0)) {
      switch (mutation.type) {
        case MUTATION_TYPE_INSERT:
          mountChild(
            mutation.node,
            mutation.afterNode !== undefined
              ? getHostDescendant(mutation.afterNode)
              : null,
          );
          break;
        case MUTATION_TYPE_UPDATE:
          applyPatch(mutation.oldNode, mutation.newNode, newNode);
          break;
        case MUTATION_TYPE_UPDATE_AND_MOVE:
          applyPatch(mutation.oldNode, mutation.newNode, newNode);
          moveChild(
            mutation.newNode,
            mutation.afterNode !== undefined
              ? getHostDescendant(mutation.afterNode)
              : null,
          );
          break;
        case MUTATION_TYPE_REMOVE:
          unmountChild(mutation.node);
          break;
      }
    }
  } else if (typeof newNode.type === 'object') {
    const oldChildren = oldNode.children;
    const newChildren = newNode.children;
    for (let i = 0, l = newChildren.length; i < l; i++) {
      applyPatch(oldChildren[i]!, newChildren[i]!, newNode);
    }
  } else {
    newNode.part.commitUpdate(
      (oldNode as RenderNode.BindNode).props.value,
      newNode.props.value,
    );
  }
}

function beforeRemove(node: RenderNode): void {
  if (typeof node.type === 'function') {
    node.state.handle.disconnect();
  }
  for (const child of node.children) {
    beforeRemove(child);
  }
}

function getHostDescendant(node: RenderNode): ChildNode | null {
  if (typeof node.type === 'object') {
    return node.state.block.staticNodes[0]!;
  }
  for (const child of node.children) {
    const hostNode = getHostDescendant(child);
    if (hostNode !== null) {
      return hostNode;
    }
  }
  return getHostSibling(node);
}

function getHostSibling(node: RenderNode): ChildNode | null {
  while (node.parent.type !== Root) {
    const children = node.parent.children;
    for (let i = node.index + 1, l = children.length; i < l; i++) {
      const hostNode = getHostDescendant(children[i]!);
      if (hostNode !== null) {
        return hostNode;
      }
    }
    node = node.parent;
  }
  return null;
}

function mountChild(child: RenderNode, afterNode: ChildNode | null): void {
  if (typeof child.type === 'object') {
    for (const grandchild of child.children) {
      mountChild(grandchild, null);
    }
    child.part.mountBlock(child.state.block, afterNode);
  } else if (typeof child.type === 'function' || child.type === Fragment) {
    for (const grandchild of child.children) {
      mountChild(grandchild, afterNode);
    }
  } else {
    child.part.commitMount(child.props.value);
  }
}

function moveChild(child: RenderNode, afterNode: ChildNode | null): void {
  if (typeof child.type === 'object') {
    child.part.moveBlock(child.state.block, afterNode);
  } else if (typeof child.type === 'function' || child.type === Fragment) {
    for (const grandchild of child.children) {
      moveChild(grandchild, afterNode);
    }
  }
}

function reparentChild(
  child: RenderNode,
  parent: RenderNode | RenderRoot,
): void {
  for (const grandchild of child.children) {
    reparentChild(grandchild, child);
  }
  child.parent = parent;
}

function replaceChild(child: RenderNode): void {
  const parent = child.parent;
  if (parent.type === Root) {
    parent.current = child;
  } else {
    parent.children[child.index] = child;
  }
}

function unmountChild(child: RenderNode, recursive: boolean = false): void {
  if (typeof child.type === 'object') {
    child.part.unmountBlock(child.state.block, recursive);
    for (const grandchild of child.children) {
      unmountChild(grandchild, true);
    }
  } else if (typeof child.type === 'function' || child.type === Fragment) {
    for (const grandchild of child.children) {
      unmountChild(grandchild, recursive);
    }
  } else {
    child.part.commitUnmount(child.props.value);
  }
}
