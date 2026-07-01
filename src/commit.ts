import {
  Bind,
  MUTATION_TYPE_INSERT,
  MUTATION_TYPE_REMOVE,
  MUTATION_TYPE_UPDATE,
  MUTATION_TYPE_UPDATE_AND_MOVE,
  type RenderNode,
  type RenderRoot,
} from './core.js';

export function mount(node: RenderNode): void {
  mountChild(node, null);
  afterCommit(node);
  replaceChild(node);
}

export function unmount(node: RenderNode): void {
  unmountChild(node);
}

export function patch(oldNode: RenderNode, newNode: RenderNode) {
  applyPatch(oldNode, newNode, newNode.index, newNode.parent);
  afterCommit(newNode);
  replaceChild(newNode);
}

function afterCommit(node: RenderNode): void {
  if (node.dirty) {
    for (const child of node.children) {
      afterCommit(child);
    }
    if (typeof node.type === 'function') {
      node.state.instance.connect(node);
    }
    node.dirty = false;
  }
}

function applyPatch(
  oldNode: RenderNode,
  newNode: RenderNode,
  index: number,
  parent: RenderNode | RenderRoot,
): void {
  if (oldNode === newNode) {
    reparentChild(oldNode, index, parent);
    return;
  }
  if (oldNode.type !== newNode.type || oldNode.key !== newNode.key) {
    unmountChild(oldNode);
    mountChild(newNode, getSiblingDOMNode(oldNode));
  } else if (newNode.type === Bind) {
    newNode.part.commitUpdate(
      (oldNode as RenderNode.BindNode).props.value,
      newNode.props.value,
    );
  } else if (typeof newNode.type === 'object') {
    const oldChildren = oldNode.children;
    const newChildren = newNode.children;
    for (let i = 0, l = newChildren.length; i < l; i++) {
      applyPatch(oldChildren[i]!, newChildren[i]!, i, newNode);
    }
  } else if (typeof newNode.type === 'function') {
    applyPatch(oldNode.children[0]!, newNode.children[0]!, 0, newNode);
  } else {
    for (const mutation of newNode.state.mutations.splice(0)) {
      switch (mutation.type) {
        case MUTATION_TYPE_INSERT:
          mountChild(
            mutation.node,
            mutation.afterNode !== undefined
              ? getChildDOMNode(mutation.afterNode)
              : null,
          );
          break;
        case MUTATION_TYPE_UPDATE:
          applyPatch(
            mutation.oldNode,
            mutation.newNode,
            mutation.index,
            newNode,
          );
          break;
        case MUTATION_TYPE_UPDATE_AND_MOVE:
          applyPatch(
            mutation.oldNode,
            mutation.newNode,
            mutation.index,
            newNode,
          );
          moveChild(
            mutation.newNode,
            mutation.afterNode !== undefined
              ? getChildDOMNode(mutation.afterNode)
              : null,
          );
          break;
        case MUTATION_TYPE_REMOVE:
          unmountChild(mutation.node);
          break;
      }
    }
  }
}

function getChildDOMNode(node: RenderNode): ChildNode | null {
  if (typeof node.type === 'object') {
    return node.state.block.staticNodes[0]!;
  }
  for (const child of node.children) {
    const domNode = getChildDOMNode(child);
    if (domNode !== null) {
      return domNode;
    }
  }
  return getSiblingDOMNode(node);
}

function getSiblingDOMNode(node: RenderNode): ChildNode | null {
  const part = node.part;
  while (node.parent.type !== null) {
    const children = node.parent.children;
    for (let i = node.index + 1, l = children.length; i < l; i++) {
      const child = children[i]!;
      if (child.part !== part) {
        break;
      }
      const domNode = getChildDOMNode(child);
      if (domNode !== null) {
        return domNode;
      }
    }
    node = node.parent;
  }
  return null;
}

function mountChild(child: RenderNode, afterNode: ChildNode | null): void {
  if (child.type === Bind) {
    child.part.commitMount(child.props.value);
  } else if (typeof child.type === 'object') {
    for (const grandchild of child.children) {
      mountChild(grandchild, null);
    }
    child.part.mountBlock(child.state.block, afterNode);
  } else {
    for (const grandchild of child.children) {
      mountChild(grandchild, afterNode);
    }
  }
}

function moveChild(child: RenderNode, afterNode: ChildNode | null): void {
  if (typeof child.type === 'object') {
    child.part.moveBlock(child.state.block, afterNode);
  } else {
    for (const grandchild of child.children) {
      moveChild(grandchild, afterNode);
    }
  }
}

function reparentChild(
  child: RenderNode,
  index: number,
  parent: RenderNode | RenderRoot,
): void {
  child.index = index;
  child.parent = parent;
}

function replaceChild(child: RenderNode): void {
  child.parent.children[child.index] = child;
}

function unmountChild(child: RenderNode, cascade: boolean = false): void {
  if (child.type === Bind) {
    child.part.commitUnmount(child.props.value, cascade);
  } else if (typeof child.type === 'object') {
    child.part.unmountBlock(child.state.block, cascade);
    for (const grandchild of child.children) {
      unmountChild(grandchild, true);
    }
  } else {
    if (typeof child.type === 'function') {
      child.state.instance.disconnect();
    }
    for (const grandchild of child.children) {
      unmountChild(grandchild, cascade);
    }
  }
}
