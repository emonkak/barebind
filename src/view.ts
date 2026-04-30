import {
  Directive,
  Fragment,
  type HostNode,
  InsertType,
  RemoveType,
  UpdateAndMoveType,
  UpdateType,
  type View,
} from './core.js';
import { NoLanes } from './lane.js';

export function mount(root: View.HostView): void {
  for (const child of root.children) {
    appendChild(root.hostNode, child, null);
  }
  root.hostNode.commitMount(root.type, root.props);
  afterCommit(root);
}

export function unmount(root: View.HostView): void {
  beforeRemove(root);
  for (const child of root.children) {
    removeChild(root.hostNode, child);
  }
}

export function patch(oldView: View, newView: View) {
  applyPatch(oldView, newView);
  afterCommit(newView);
  reparent(newView);
}

function afterCommit(view: View): void {
  if (view.type === Directive) {
    if (view.dirty) {
      const { setup } = view.props;
      view.cleanup?.call(undefined);
      view.cleanup = setup(getHostAncestor(view).refNode);
      view.dirty = false;
    }
  }

  for (const descendant of view.children) {
    afterCommit(descendant);
  }

  if (typeof view.type === 'function') {
    view.instance.afterCommit();
  }
}

function appendChild(
  parentNode: HostNode,
  view: View,
  afterNode: HostNode | null,
): void {
  if (isNativeNode(view)) {
    for (const descendant of view.children) {
      appendChild(view.hostNode, descendant, null);
    }
    parentNode.appendChild(view.hostNode, afterNode);
    view.hostNode.commitMount(view.type, view.props);
  } else {
    for (const descendant of view.children) {
      appendChild(parentNode, descendant, afterNode);
    }
  }
}

function applyPatch(oldView: View, newView: View): void {
  if (oldView.id === newView.id) {
    return;
  }
  if (oldView.type !== newView.type || oldView.key !== newView.key) {
    removeSubview(getHostAncestor(oldView), oldView);
    appendChild(getHostAncestor(newView), newView, nextHostSibling(oldView));
  } else if (typeof newView.type === 'function') {
    (oldView as View.ComponentView).scope.pendingLanes = NoLanes;
    applyPatch(oldView.children[0]!, newView.children[0]!);
  } else if (newView.type === Directive) {
    // skip
  } else if (newView.type === Fragment) {
    const parentNode = getHostAncestor(newView);

    for (const mutation of newView.mutations) {
      switch (mutation.type) {
        case InsertType:
          appendChild(
            parentNode,
            mutation.view,
            mutation.afterView !== undefined
              ? getHostDescendant(mutation.afterView)
              : null,
          );
          break;
        case UpdateType:
          applyPatch(mutation.oldView, mutation.newView);
          break;
        case UpdateAndMoveType:
          moveChild(
            parentNode,
            mutation.newView,
            mutation.afterView !== undefined
              ? getHostDescendant(mutation.afterView)
              : null,
          );
          applyPatch(mutation.oldView, mutation.newView);
          break;
        case RemoveType:
          removeSubview(parentNode, mutation.view);
          break;
      }
    }
  } else {
    const oldChildren = oldView.children;
    const newChildren = newView.children;

    for (let i = 0, l = newChildren.length; i < l; i++) {
      applyPatch(oldChildren[i]!, newChildren[i]!);
    }

    newView.hostNode.commitUpdate(
      newView.type,
      (oldView as View.HostView).props,
      newView.props,
    );
  }
}

function beforeRemove(view: View): void {
  if (typeof view.type === 'function') {
    view.instance.beforeRemove();
    view.scope.pendingLanes = NoLanes;
  } else if (view.type === Directive) {
    view.cleanup?.call(undefined);
    view.cleanup = undefined;
  }

  for (const child of view.children) {
    beforeRemove(child);
  }
}

function getHostAncestor(view: View): HostNode {
  while (view.parent !== null) {
    if (isNativeNode(view.parent)) {
      return view.parent.hostNode;
    }
    view = view.parent;
  }
  return (view as View.HostView).hostNode;
}

function getHostDescendant(view: View): HostNode | null {
  if (isNativeNode(view)) {
    return view.hostNode;
  }
  for (const child of view.children) {
    const hostNode = getHostDescendant(child);
    if (hostNode !== null) {
      return hostNode;
    }
  }
  return nextHostSibling(view);
}

function isNativeNode(view: View): view is View.HostView {
  return (
    typeof view.type !== 'function' &&
    view.type !== Directive &&
    view.type !== Fragment
  );
}

function moveChild(
  parentNode: HostNode,
  child: View,
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

function nextHostSibling(child: View): HostNode | null {
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

function removeChild(parentNode: HostNode, child: View): void {
  if (isNativeNode(child)) {
    parentNode.removeChild(child.hostNode);
  } else {
    for (const descendant of child.children) {
      removeChild(parentNode, descendant);
    }
  }
}

function removeSubview(parentNode: HostNode, child: View): void {
  beforeRemove(child);
  removeChild(parentNode, child);
}

function reparent(view: View): void {
  if (view.parent !== null) {
    view.parent.children[view.index] = view;
  }
}
