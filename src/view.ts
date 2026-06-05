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

export function mount(root: View.HostView): void {
  for (const child of root.children) {
    appendChild(root.data, child, null);
  }
  root.data.commitMount(root.type, root.props);
  afterCommit(root);
}

export function unmount(root: View.HostView): void {
  beforeRemove(root);
  for (const child of root.children) {
    removeChild(root.data, child);
  }
}

export function patch(oldView: View, newView: View) {
  applyPatch(oldView, newView);
  afterCommit(newView);
  reparent(newView);
}

function afterCommit(view: View): void {
  if (view.type === Directive) {
    if (view.data.dirty) {
      const { setup } = view.props;
      view.data.cleanup?.call(undefined);
      view.data.cleanup = setup(getHostAncestor(view).refNode);
      view.data.dirty = false;
    }
  }

  for (const descendant of view.children) {
    afterCommit(descendant);
  }

  if (typeof view.type === 'function') {
    view.data.afterCommit(view);
  }
}

function appendChild(
  parentNode: HostNode,
  view: View,
  afterNode: HostNode | null,
): void {
  if (isHostView(view)) {
    for (const descendant of view.children) {
      appendChild(view.data, descendant, null);
    }
    parentNode.appendChild(view.data, afterNode);
    view.data.commitMount(view.type, view.props);
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
    applyPatch(oldView.children[0]!, newView.children[0]!);
  } else if (newView.type === Directive) {
    // skip
  } else if (newView.type === Fragment) {
    const parentNode = getHostAncestor(newView);

    for (const mutation of newView.data) {
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

    newView.data.commitUpdate(
      newView.type,
      (oldView as View.HostView).props,
      newView.props,
    );
  }
}

function beforeRemove(view: View): void {
  if (typeof view.type === 'function') {
    view.data.beforeRemove();
  } else if (view.type === Directive) {
    view.data.cleanup?.call(undefined);
    view.data.cleanup = undefined;
  }

  for (const child of view.children) {
    beforeRemove(child);
  }
}

function getHostAncestor(view: View): HostNode {
  while (view.parent !== null) {
    if (isHostView(view.parent)) {
      return view.parent.data;
    }
    view = view.parent;
  }
  return (view as View.HostView).data;
}

function getHostDescendant(view: View): HostNode | null {
  if (isHostView(view)) {
    return view.data;
  }
  for (const child of view.children) {
    const hostNode = getHostDescendant(child);
    if (hostNode !== null) {
      return hostNode;
    }
  }
  return nextHostSibling(view);
}

function isHostView(view: View): view is View.HostView {
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
  if (isHostView(child)) {
    parentNode.moveChild(child.data, afterNode);
  } else {
    for (const descendant of child.children) {
      moveChild(parentNode, descendant, afterNode);
    }
  }
}

function nextHostSibling(child: View): HostNode | null {
  while (child.parent !== null && !isHostView(child.parent)) {
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
  if (isHostView(child)) {
    parentNode.removeChild(child.data);
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
