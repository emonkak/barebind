import {
  Fragment,
  type HostAdapter,
  type HostNode,
  type RenderContext,
  toElement,
  type VComponent,
  type VElement,
  type VFragment,
  type VHostElement,
  type VPortal,
} from './core.js';

// Mutation types
const INSERT_TYPE = 0;
const UPDATE_TYPE = 1;
const UPDATE_AND_MOVE_TYPE = 2;
const REMOVE_TYPE = 3;

export interface ComponentChild {
  type: VComponent['type'];
  props: VComponent['props'];
  key: VComponent['key'];
  children: RenderChild[];
  context: RenderContext;
  index: number;
  parent: RenderTree;
}

export interface FragmentChild {
  type: VFragment['type'];
  props: VFragment['props'];
  key: VFragment['key'];
  children: RenderChild[];
  mutations: Mutation[];
  index: number;
  parent: RenderTree;
}

export interface HostChild {
  type: VHostElement['type'];
  props: VHostElement['props'];
  key: VHostElement['key'];
  children: RenderChild[];
  hostNode: HostNode;
  index: number;
  parent: RenderTree;
}

export type HostTree = RenderRoot | HostChild;

export type RenderChild = ComponentChild | FragmentChild | HostChild;

export interface RenderRoot {
  type: VPortal['type'];
  props: VPortal['props'];
  key: VPortal['key'];
  children: RenderChild[];
  hostNode: HostNode;
  index: number;
  parent: null;
}

export type RenderTree = RenderRoot | RenderChild;

type Mutation =
  | {
      type: typeof INSERT_TYPE;
      tree: RenderTree;
      afterTree: RenderTree | undefined;
    }
  | {
      type: typeof UPDATE_TYPE;
      oldTree: RenderTree;
      newTree: RenderTree;
    }
  | {
      type: typeof UPDATE_AND_MOVE_TYPE;
      oldTree: RenderTree;
      newTree: RenderTree;
      afterTree: RenderTree | undefined;
    }
  | {
      type: typeof REMOVE_TYPE;
      tree: RenderTree;
    };

export class Reconciler {
  private _adapter: HostAdapter;

  constructor(renderer: HostAdapter) {
    this._adapter = renderer;
  }

  diff(oldTree: RenderRoot, element: VElement): RenderRoot;
  diff(oldTree: RenderChild, newElement: VElement): RenderChild;
  diff(oldTree: RenderTree, newElement: VElement): RenderTree;
  diff(oldTree: RenderTree, newElement: VElement): RenderTree {
    if (oldTree.type !== newElement.type || oldTree.key !== newElement.key) {
      return this.render(newElement, oldTree.index, oldTree.parent);
    } else if (typeof newElement.type === 'function') {
      if (
        newElement.type.arePropsEqual(
          (oldTree as ComponentChild).props,
          newElement.props,
        )
      ) {
        return oldTree;
      }
      const newTree: ComponentChild = {
        ...newElement,
        ...(oldTree as ComponentChild),
      };
      const returnValue = newElement.type.render.call(
        newTree.context,
        newElement.props,
      );
      newTree.children[0] = this.diff(
        oldTree.children[0]!,
        toElement(returnValue),
      );
      return newTree;
    } else if (newElement.type === Fragment) {
      const mutations: Mutation[] = [];
      const children = this._diffChildren(
        (oldTree as FragmentChild).children.slice(),
        newElement.children,
        oldTree.parent!,
        mutations,
      );
      return {
        ...newElement,
        ...(oldTree as FragmentChild),
        children,
        mutations,
      };
    } else {
      const dirty = (oldTree as HostChild).hostNode.prepareUpdate(
        newElement.type,
        (oldTree as HostChild).props,
        newElement.props,
      );
      return dirty
        ? {
            ...newElement,
            ...(oldTree as HostChild),
            children: newElement.children.map((element, i) =>
              this.diff((oldTree as HostChild).children[i]!, element),
            ),
          }
        : oldTree;
    }
  }

  mount(tree: RenderRoot): void {
    tree.hostNode.commitMount(tree.type, tree.props);
    for (const child of tree.children) {
      this._appendChild(tree.hostNode, child, null);
    }
  }

  patch(oldTree: RenderTree, newTree: RenderTree): void {
    if (oldTree === newTree) {
      return;
    }
    if (oldTree.type !== newTree.type || oldTree.key !== newTree.key) {
      this._removeChild(getHostAncestor(oldTree), oldTree);
      this._appendChild(
        getHostAncestor(newTree),
        newTree,
        nextHostSibling(oldTree),
      );
    } else if (typeof newTree.type === 'function') {
      this.patch(oldTree.children[0]!, newTree.children[0]!);
    } else if (newTree.type === Fragment) {
      const parentNode = getHostAncestor(newTree.parent);

      for (const mutation of newTree.mutations) {
        switch (mutation.type) {
          case INSERT_TYPE:
            this._appendChild(
              parentNode,
              mutation.tree,
              mutation.afterTree !== undefined
                ? getHostDescendant(mutation.afterTree)
                : null,
            );
            break;
          case UPDATE_TYPE:
            this.patch(mutation.oldTree, mutation.newTree);
            break;
          case UPDATE_AND_MOVE_TYPE:
            this._moveChild(
              parentNode,
              mutation.newTree,
              mutation.afterTree !== undefined
                ? getHostDescendant(mutation.afterTree)
                : null,
            );
            this.patch(mutation.oldTree, mutation.newTree);
            break;
          case REMOVE_TYPE:
            this._removeChild(parentNode, mutation.tree);
            break;
        }
      }
    } else {
      const oldChildren = oldTree.children;
      const newChildren = newTree.children;

      for (let i = newChildren.length, l = oldChildren.length; i < l; i++) {
        const child = oldChildren[i]!;
        this._removeChild(getHostAncestor(child), child);
      }

      for (
        let i = 0, l = Math.min(oldChildren.length, newChildren.length);
        i < l;
        i++
      ) {
        this.patch(oldChildren[i]!, newChildren[i]!);
      }

      for (let i = oldChildren.length, l = newChildren.length; i < l; i++) {
        const child = newChildren[i]!;
        this._appendChild(newTree.hostNode, child, null);
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

  render(element: VElement): RenderRoot;
  render(element: VElement, index: number, parent: RenderTree): RenderChild;
  render(
    element: VElement,
    index: number,
    parent: RenderTree | null,
  ): RenderTree;
  render(
    element: VElement,
    index: number = 0,
    parent: RenderTree | null = null,
  ): RenderTree {
    if (typeof element.type === 'function') {
      const tree: ComponentChild = {
        ...element,
        children: new Array(1),
        context: {},
        index,
        parent: parent!,
      };
      const returnValue = element.type.render.call(tree.context, element.props);
      tree.children[0] = this.render(toElement(returnValue), 0, tree);
      return tree;
    } else if (element.type === Fragment) {
      const tree: FragmentChild = {
        ...element,
        children: new Array(element.children.length),
        mutations: [],
        index,
        parent: parent!,
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        tree.children[i] = this.render(element.children[i]!, i, tree);
      }
      return tree;
    } else {
      const tree: HostTree = {
        ...element,
        children: new Array(element.children.length),
        hostNode: this._adapter.renderNode(element),
        index,
        parent: parent!,
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        tree.children[i] = this.render(element.children[i]!, i, tree);
      }
      return tree;
    }
  }

  unmount(tree: RenderRoot): void {
    for (const child of tree.children) {
      this._removeChild(tree.hostNode, child);
    }
  }

  private _appendChild(
    parentNode: HostNode,
    child: RenderTree,
    afterNode: HostNode | null,
  ): void {
    if (isHostTree(child)) {
      parentNode.appendChild(child.hostNode, afterNode);
      for (const descendant of child.children) {
        this._appendChild(child.hostNode, descendant, null);
      }
      child.hostNode.commitMount(child.type, child.props);
    } else {
      for (const descendant of child.children) {
        this._appendChild(parentNode, descendant, afterNode);
      }
    }
  }

  private _diffChildren(
    oldChildren: (RenderChild | undefined)[],
    newElements: VElement[],
    parent: RenderTree,
    mutations: Mutation[],
  ): RenderChild[] {
    const oldKeys = oldChildren.map((tree) => tree!.key);
    const newKeys = newElements.map((element) => element.key);
    const newChildren: RenderChild[] = new Array(newElements.length);

    let oldHead = 0;
    let newHead = 0;
    let oldTail = oldKeys.length - 1;
    let newTail = newKeys.length - 1;
    let oldKeyToIndexMap: Map<unknown, number> | undefined;
    let newKeyToIndexMap: Map<unknown, number> | undefined;

    while (true) {
      if (newHead > newTail) {
        while (oldHead <= oldTail) {
          const tree = oldChildren[oldHead];
          if (tree !== undefined) {
            mutations.push({
              type: REMOVE_TYPE,
              tree,
            });
          }
          oldHead++;
        }
        break;
      } else if (oldHead > oldTail) {
        while (newHead <= newTail) {
          const tree = this.render(newElements[newHead]!, newHead, parent);
          mutations.push({
            type: INSERT_TYPE,
            tree,
            afterTree: newChildren[newTail + 1],
          });
          newChildren[newHead] = tree;
          newHead++;
        }
        break;
      } else if (oldChildren[oldHead] === undefined) {
        oldHead++;
      } else if (oldChildren[oldTail] === undefined) {
        oldTail--;
      } else if (Object.is(oldKeys[oldHead]!, newKeys[newHead]!)) {
        const newTree = this.diff(oldChildren[oldHead]!, newElements[newHead]!);
        mutations.push({
          type: UPDATE_TYPE,
          oldTree: oldChildren[oldHead]!,
          newTree,
        });
        newChildren[newHead] = newTree;
        oldHead++;
        newHead++;
      } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        const newTree = this.diff(oldChildren[oldTail]!, newElements[newTail]!);
        mutations.push({
          type: UPDATE_TYPE,
          oldTree: oldChildren[oldTail]!,
          newTree,
        });
        newChildren[newTail] = newTree;
        oldTail--;
        newTail--;
      } else if (
        Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
        Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
      ) {
        const headTree = this.diff(
          oldChildren[oldHead]!,
          newElements[newTail]!,
        );
        const tailTree = this.diff(
          oldChildren[oldTail]!,
          newElements[newHead]!,
        );
        mutations.push({
          type: UPDATE_AND_MOVE_TYPE,
          oldTree: oldChildren[oldHead]!,
          newTree: headTree,
          afterTree: newChildren[newTail + 1],
        });
        mutations.push({
          type: UPDATE_AND_MOVE_TYPE,
          oldTree: oldChildren[oldTail]!,
          newTree: tailTree,
          afterTree: oldChildren[oldHead],
        });
        newChildren[newTail] = headTree;
        newChildren[newHead] = tailTree;
        oldHead++;
        newHead++;
        oldTail--;
        newTail--;
      } else {
        newKeyToIndexMap ??= buildKeyToIndexMap(newKeys, newHead, newTail);

        if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
          mutations.push({
            type: REMOVE_TYPE,
            tree: oldChildren[oldHead]!,
          });
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          mutations.push({
            type: REMOVE_TYPE,
            tree: oldChildren[oldTail]!,
          });
          oldTail--;
        } else {
          oldKeyToIndexMap ??= buildKeyToIndexMap(oldKeys, oldHead, oldTail);
          const oldIndex = oldKeyToIndexMap.get(newKeys[newTail]!);

          if (
            oldIndex !== undefined &&
            oldIndex >= oldHead &&
            oldIndex <= oldTail &&
            oldChildren[oldIndex] !== undefined
          ) {
            const newTree = this.diff(
              oldChildren[oldIndex]!,
              newElements[newTail]!,
            );
            mutations.push({
              type: UPDATE_AND_MOVE_TYPE,
              oldTree: oldChildren[oldIndex]!,
              newTree,
              afterTree: newChildren[newTail + 1],
            });
            newChildren[newTail] = newTree;
            oldChildren[oldIndex] = undefined;
          } else {
            const tree = this.render(newElements[newTail]!, newTail, parent);
            mutations.push({
              type: INSERT_TYPE,
              tree,
              afterTree: newChildren[newTail + 1],
            });
            newChildren[newTail] = tree;
          }

          newTail--;
        }
      }
    }

    return newChildren;
  }

  private _moveChild(
    parentNode: HostNode,
    child: RenderTree,
    afterNode: HostNode | null,
  ): void {
    if (isHostTree(child)) {
      parentNode.moveChild(child.hostNode, afterNode);
    } else {
      for (const descendant of child.children) {
        this._moveChild(parentNode, descendant, afterNode);
      }
    }
  }

  private _removeChild(parentNode: HostNode, child: RenderTree): void {
    if (isHostTree(child)) {
      parentNode.removeChild(child.hostNode);
    } else {
      for (const descendant of child.children) {
        this._removeChild(parentNode, descendant);
      }
    }
  }
}

function buildKeyToIndexMap<T>(
  keys: T[],
  head: number,
  tail: number,
): Map<T, number> {
  const keyToIndexMap = new Map();
  for (let i = head; i <= tail; i++) {
    keyToIndexMap.set(keys[i]!, i);
  }
  return keyToIndexMap;
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

function nextHostSibling(tree: RenderTree): HostNode | null {
  while (tree.parent !== null) {
    for (let i = tree.index + 1, l = tree.parent.children.length; i < l; i++) {
      const hostNode = getHostDescendant(tree.parent.children[i]!);
      if (hostNode !== null) {
        return hostNode;
      }
    }
    if (isHostTree(tree.parent)) {
      break;
    }
    tree = tree.parent;
  }
  return null;
}
