import { areDependenciesChange } from './compare.js';
import {
  createScope,
  Directive,
  Fragment,
  type HostAdapter,
  type HostNode,
  type HostTree,
  InsertType,
  type Lanes,
  type Mutation,
  RemoveType,
  type RenderChild,
  type RenderRoot,
  type RenderTree,
  type Scope,
  UpdateAndMoveType,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type UpdateScheduler,
  UpdateType,
  type VElement,
} from './core.js';
import {
  getHighestPriorityLane,
  getRenderLanes,
  NoLanes,
  ViewTransitionLane,
} from './lane.js';
import { PriorityQueue } from './queue.js';

interface Update {
  id: number;
  lanes: Lanes;
  origin: RenderChild.ComponentChild;
  controller: PromiseWithResolvers<UpdateResult>;
}

export class Runtime implements UpdateScheduler {
  private readonly _adapter: HostAdapter;
  private readonly _updateQueue: PriorityQueue<Update> = new PriorityQueue(
    compareUpdates,
  );
  private _pendingLanes: number = NoLanes;
  private _flushLanes: number = NoLanes;
  private _identifierCount: number = 0;
  private _transitionCount: number = 0;
  private _updateCount: number = 0;

  constructor(renderer: HostAdapter) {
    this._adapter = renderer;
  }

  get flushLanes(): Lanes {
    return this._flushLanes;
  }

  diff(oldTree: RenderRoot, element: VElement): RenderRoot;
  diff(
    oldTree: RenderChild,
    newElement: VElement,
    scope: Scope | null,
  ): RenderChild;
  diff(
    oldTree: RenderTree,
    newElement: VElement,
    scope: Scope | null,
  ): RenderTree;
  diff(
    oldTree: RenderTree,
    newElement: VElement,
    scope: Scope | null = null,
  ): RenderTree {
    if (oldTree.type !== newElement.type || oldTree.key !== newElement.key) {
      return this.render(newElement, oldTree.index, oldTree.parent, scope);
    } else if (typeof newElement.type === 'function') {
      if (
        ((oldTree as RenderChild.ComponentChild).scope.pendingLanes &
          this.flushLanes) ===
          NoLanes &&
        newElement.type.arePropsEqual(
          (oldTree as RenderChild.ComponentChild).props,
          newElement.props,
        )
      ) {
        return oldTree;
      }
      const newTree: RenderChild.ComponentChild = {
        ...(oldTree as RenderChild.ComponentChild),
        ...newElement,
        children: new Array(1),
        scope: createScope(scope),
      };
      const returnElement = newTree.instance.render(newTree);
      newTree.children[0] = this.diff(
        oldTree.children[0]!,
        returnElement,
        Object.freeze(newTree.scope),
      );
      return newTree;
    } else if (newElement.type === Directive) {
      return {
        ...(oldTree as RenderChild.DirectiveChild),
        ...newElement,
        dirty: areDependenciesChange(
          (oldTree as RenderChild.DirectiveChild).props.deps,
          newElement.props.deps,
        ),
      };
    } else if (newElement.type === Fragment) {
      const mutations: Mutation[] = [];
      const children = this._diffChildren(
        (oldTree as RenderChild.FragmentChild).children.slice(),
        newElement.children,
        oldTree.parent!,
        scope,
        mutations,
      );
      return {
        ...(oldTree as RenderChild.FragmentChild),
        ...newElement,
        children,
        mutations,
      };
    } else {
      const dirty = (oldTree as RenderChild.HostChild).hostNode.prepareUpdate(
        newElement.type,
        (oldTree as RenderChild.HostChild).props,
        newElement.props,
      );
      return dirty
        ? {
            ...(oldTree as RenderChild.HostChild),
            ...newElement,
            children: newElement.children.map((element, i) =>
              this.diff(
                (oldTree as RenderChild.HostChild).children[i]!,
                element,
                scope,
              ),
            ),
          }
        : oldTree;
    }
  }

  async flush(): Promise<void> {
    let update: Update | undefined;

    while ((update = this._updateQueue.peek()) !== undefined) {
      const { controller, origin, lanes } = update;

      if ((this._flushLanes & lanes) !== lanes) {
        break;
      }

      try {
        if ((origin.scope.pendingLanes & lanes) === NoLanes) {
          controller.resolve({ status: 'skipped' });
          continue;
        }

        const newOrigin: RenderChild.ComponentChild = {
          ...origin,
          scope: createScope(origin.scope.parent),
        };
        const returnElement = newOrigin.instance.render(newOrigin);

        newOrigin.children[0] = this.diff(
          newOrigin.children[0]!,
          returnElement,
          Object.freeze(newOrigin.scope),
        );

        const commit = () => {
          patch(origin, newOrigin);
          afterCommit(newOrigin);
        };

        if (lanes & ViewTransitionLane) {
          await this._adapter.startViewTransition(commit);
        } else {
          await this._adapter.requestCommit(commit);
        }

        controller.resolve({ status: 'done' });
      } catch (error) {
        controller.reject(error);
      } finally {
        this._updateQueue.dequeue();
      }
    }

    this._flushLanes = NoLanes;
  }

  nextIdentifier(): string {
    return this._adapter.getIdentifier() + '-' + this._identifierCount++;
  }

  nextTransition(): number {
    return this._transitionCount++;
  }

  render(element: VElement): RenderRoot;
  render(
    element: VElement,
    index: number,
    parent: RenderTree,
    scope: Scope | null,
  ): RenderChild;
  render(
    element: VElement,
    index: number,
    parent: RenderTree | null,
    scope: Scope | null,
  ): RenderTree;
  render(
    element: VElement,
    index: number = 0,
    parent: RenderTree | null = null,
    scope: Scope | null = null,
  ): RenderTree {
    if (typeof element.type === 'function') {
      const tree: RenderChild.ComponentChild = {
        ...element,
        parent: parent!,
        children: new Array(1),
        index,
        instance: element.type.getInstance(element.props, this),
        scope: createScope(scope),
      };
      const returnElement = tree.instance.render(tree);
      tree.children[0] = this.render(
        returnElement,
        0,
        tree,
        Object.freeze(tree.scope),
      );
      return tree;
    } else if (element.type === Directive) {
      return {
        ...element,
        parent: parent!,
        children: [],
        index,
        dirty: true,
        cleanup: undefined,
      };
    } else if (element.type === Fragment) {
      const tree: RenderChild.FragmentChild = {
        ...element,
        parent: parent!,
        children: new Array(element.children.length),
        index,
        mutations: [],
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        tree.children[i] = this.render(element.children[i]!, i, tree, scope);
      }
      return tree;
    } else {
      const tree: HostTree = {
        ...element,
        parent: parent!,
        children: new Array(element.children.length),
        index,
        hostNode: this._adapter.renderElement(element),
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        tree.children[i] = this.render(element.children[i]!, i, tree, scope);
      }
      return tree;
    }
  }

  schedule(
    origin: RenderChild.ComponentChild,
    options: UpdateOptions = {},
  ): UpdateHandle {
    options.priority ??=
      options.transition !== undefined || options.delay !== undefined
        ? 'background'
        : options.flushSync
          ? 'user-blocking'
          : this._adapter.getTaskPriority();

    const controller = Promise.withResolvers<UpdateResult>();
    const id = this._updateCount++;
    const lanes = getRenderLanes(options);

    this._updateQueue.enqueue({
      id,
      lanes,
      origin,
      controller,
    });

    if (
      (this._pendingLanes & lanes) !== lanes &&
      (this._flushLanes & lanes) !== lanes
    ) {
      this._adapter.requestCallback(() => {
        const shouldFlush =
          (options.triggerFlush ?? true) && this._flushLanes === NoLanes;
        this._pendingLanes &= ~lanes;
        this._flushLanes |= lanes;
        if (shouldFlush) {
          this.flush();
        }
      }, options);
      this._pendingLanes |= lanes;
    }

    return {
      id,
      lanes,
      finished: controller.promise,
    };
  }

  private _diffChildren(
    oldChildren: (RenderChild | undefined)[],
    newElements: VElement[],
    parent: RenderTree,
    scope: Scope | null,
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
              type: RemoveType,
              tree,
            });
          }
          oldHead++;
        }
        break;
      } else if (oldHead > oldTail) {
        while (newHead <= newTail) {
          const tree = this.render(
            newElements[newHead]!,
            newHead,
            parent,
            scope,
          );
          mutations.push({
            type: InsertType,
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
        const newTree = this.diff(
          oldChildren[oldHead]!,
          newElements[newHead]!,
          scope,
        );
        mutations.push({
          type: UpdateType,
          oldTree: oldChildren[oldHead]!,
          newTree,
        });
        newChildren[newHead] = newTree;
        oldHead++;
        newHead++;
      } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        const newTree = this.diff(
          oldChildren[oldTail]!,
          newElements[newTail]!,
          scope,
        );
        mutations.push({
          type: UpdateType,
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
          scope,
        );
        const tailTree = this.diff(
          oldChildren[oldTail]!,
          newElements[newHead]!,
          scope,
        );
        mutations.push({
          type: UpdateAndMoveType,
          oldTree: oldChildren[oldHead]!,
          newTree: headTree,
          afterTree: newChildren[newTail + 1],
        });
        mutations.push({
          type: UpdateAndMoveType,
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
            type: RemoveType,
            tree: oldChildren[oldHead]!,
          });
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          mutations.push({
            type: RemoveType,
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
              scope,
            );
            mutations.push({
              type: UpdateAndMoveType,
              oldTree: oldChildren[oldIndex]!,
              newTree,
              afterTree: newChildren[newTail + 1],
            });
            newChildren[newTail] = newTree;
            oldChildren[oldIndex] = undefined;
          } else {
            const tree = this.render(
              newElements[newTail]!,
              newTail,
              parent,
              scope,
            );
            mutations.push({
              type: InsertType,
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
}

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

export function update(oldTree: RenderTree, newTree: RenderTree) {
  patch(oldTree, newTree);
  afterCommit(newTree);
}

function afterCommit(tree: RenderTree): void {
  if (typeof tree.type === 'function') {
    tree.instance.afterCommit();
  } else if (tree.type === Directive) {
    if (tree.dirty) {
      tree.cleanup?.();
      tree.cleanup = tree.props.setup(getHostAncestor(tree).refInstance);
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

function beforeRemove(tree: RenderTree): void {
  if (typeof tree.type === 'function') {
    tree.instance.beforeRemove();
  } else if (tree.type === Directive) {
    tree.cleanup?.();
    tree.cleanup = undefined;
  }

  for (const child of tree.children) {
    beforeRemove(child);
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

function compareUpdates(x: Update, y: Update): number {
  const p1 = getHighestPriorityLane(x.lanes);
  const p2 = getHighestPriorityLane(y.lanes);
  return p1 !== p2 ? p1 - p2 : x.origin.scope.level - y.origin.scope.level;
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

function patch(oldTree: RenderTree, newTree: RenderTree): void {
  if (oldTree === newTree) {
    return;
  }
  if (oldTree.type !== newTree.type || oldTree.key !== newTree.key) {
    removeChild(getHostAncestor(oldTree), oldTree);
    appendChild(getHostAncestor(newTree), newTree, nextHostSibling(oldTree));
  } else if (typeof newTree.type === 'function') {
    patch(oldTree.children[0]!, newTree.children[0]!);
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
          patch(mutation.oldTree, mutation.newTree);
          break;
        case UpdateAndMoveType:
          moveChild(
            parentNode,
            mutation.newTree,
            mutation.afterTree !== undefined
              ? getHostDescendant(mutation.afterTree)
              : null,
          );
          patch(mutation.oldTree, mutation.newTree);
          break;
        case RemoveType:
          removeChild(parentNode, mutation.tree);
          break;
      }
    }
  } else {
    const oldChildren = oldTree.children;
    const newChildren = newTree.children;

    for (let i = newChildren.length, l = oldChildren.length; i < l; i++) {
      const child = oldChildren[i]!;
      removeChild(getHostAncestor(child), child);
    }

    for (
      let i = 0, l = Math.min(oldChildren.length, newChildren.length);
      i < l;
      i++
    ) {
      patch(oldChildren[i]!, newChildren[i]!);
    }

    for (let i = oldChildren.length, l = newChildren.length; i < l; i++) {
      const child = newChildren[i]!;
      appendChild(newTree.hostNode, child, null);
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
