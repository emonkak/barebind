import { areDependenciesChange } from './compare.js';
import {
  Directive,
  type Dispatcher,
  Fragment,
  type HostAdapter,
  InsertType,
  type Lanes,
  type Mutation,
  type Reconciler,
  RemoveType,
  type RenderTree,
  Scope,
  UpdateAndMoveType,
  type UpdateHandle,
  type UpdateOptions,
  UpdateType,
  type UpdateUnit,
  type VElement,
} from './core.js';
import {
  getHighestPriorityLane,
  getLaneFromPriority,
  getPriorityFromLanes,
  getRenderLanes,
  NoLanes,
  SyncLane,
  ViewTransitionLane,
} from './lane.js';
import { PriorityQueue } from './queue.js';

interface Update {
  id: number;
  lanes: Lanes;
  unit: UpdateUnit;
  controller: PromiseWithResolvers<void>;
}

export class Runtime implements Reconciler, Dispatcher {
  private readonly _adapter: HostAdapter;
  private readonly _updateQueue: PriorityQueue<Update> = new PriorityQueue(
    compareUpdates,
  );
  private _pendingLanes: number = NoLanes;
  private _stagedLanes: number = NoLanes;
  private _flushLanes: number = NoLanes;
  private _identifierCount: number = 0;
  private _renderCount: number = 0;
  private _transitionCount: number = 0;
  private _updateCount: number = 0;

  constructor(renderer: HostAdapter) {
    this._adapter = renderer;
  }

  get flushLanes(): Lanes {
    return this._flushLanes;
  }

  diff(
    oldTree: RenderTree,
    newElement: VElement,
    scope: Scope,
    index: number = oldTree.index,
    parent: RenderTree | null = oldTree.parent,
  ): RenderTree {
    const newTree = this._diffChild(oldTree, newElement, scope, index, parent);
    this._settleSubtree(oldTree);
    return newTree;
  }

  nextIdentifier(): string {
    return this._adapter.getIdentifier() + '-' + this._identifierCount++;
  }

  nextRenderId(): number {
    return this._renderCount++;
  }

  nextTransition(): number {
    return this._transitionCount++;
  }

  render(
    element: VElement,
    scope: Scope,
    index: number = 0,
    parent: RenderTree | null = null,
  ): RenderTree {
    if (typeof element.type === 'function') {
      const tree: RenderTree.ComponentNode = {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(1),
        instance: element.type.newInstance(element.props, this),
        scope: new Scope(scope),
      };
      tree.instance.connect(tree);
      const returnElement = tree.instance.render(tree);
      tree.children[0] = this.render(returnElement, tree.scope, 0, tree);
      return tree;
    } else if (element.type === Directive) {
      return {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: [],
        dirty: true,
        cleanup: undefined,
      };
    } else if (element.type === Fragment) {
      const tree: RenderTree.FragmentNode = {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(element.children.length),
        mutations: [],
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        tree.children[i] = this.render(element.children[i]!, scope, i, tree);
      }
      return tree;
    } else {
      const tree: RenderTree.NativeNode = {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(element.children.length),
        hostNode: this._adapter.renderElement(element),
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        tree.children[i] = this.render(element.children[i]!, scope, i, tree);
      }
      return tree;
    }
  }

  schedule(unit: UpdateUnit, options: UpdateOptions = {}): UpdateHandle {
    const controller = Promise.withResolvers<void>();
    const id = this._updateCount++;
    const lanes =
      getRenderLanes(options) ||
      getLaneFromPriority(this._adapter.getTaskPriority());

    this._updateQueue.enqueue({
      id,
      lanes,
      unit,
      controller,
    });

    unit.scope.pendingLanes |= lanes;

    if (((this._pendingLanes | this._stagedLanes) & lanes) !== lanes) {
      const priority = getPriorityFromLanes(lanes);
      this._pendingLanes |= lanes;
      this._adapter.requestCallback(
        () => {
          const shouldFlush = this._flushLanes === NoLanes;
          this._pendingLanes &= ~lanes;
          this._stagedLanes |= lanes;
          if (shouldFlush) {
            this._flush();
          }
        },
        { ...options, priority },
      );
    }

    return {
      id,
      lanes,
      finished: controller.promise,
    };
  }

  private _diffChild(
    oldTree: RenderTree,
    newElement: VElement,
    scope: Scope,
    index: number,
    parent: RenderTree | null,
  ): RenderTree {
    if (oldTree.type !== newElement.type || oldTree.key !== newElement.key) {
      return this.render(newElement, scope, index, parent);
    } else if (typeof newElement.type === 'function') {
      if (
        ((oldTree as RenderTree.ComponentNode).scope.pendingLanes &
          this._flushLanes) ===
          NoLanes &&
        newElement.type.arePropsEqual(
          (oldTree as RenderTree.ComponentNode).props,
          newElement.props,
        )
      ) {
        const newTree = {
          ...(oldTree as RenderTree.ComponentNode),
          index,
          parent,
          scope: new Scope(
            scope,
            (oldTree as RenderTree.ComponentNode).scope.pendingLanes &
              ~this._flushLanes,
          ),
        };
        newTree.instance.connect(newTree);
        return newTree;
      }
      const newTree: RenderTree.ComponentNode = {
        ...(oldTree as RenderTree.ComponentNode),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(1),
        scope: new Scope(
          scope,
          (oldTree as RenderTree.ComponentNode).scope.pendingLanes,
        ),
      };
      newTree.instance.connect(newTree);
      const returnElement = newTree.instance.render(newTree);
      newTree.scope.pendingLanes &= ~this._flushLanes;
      newTree.children[0] = this._diffChild(
        oldTree.children[0]!,
        returnElement,
        newTree.scope,
        index,
        newTree,
      );
      return newTree;
    } else if (newElement.type === Directive) {
      return {
        ...(oldTree as RenderTree.DirectiveNode),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
        dirty: areDependenciesChange(
          (oldTree as RenderTree.DirectiveNode).props.deps,
          newElement.props.deps,
        ),
      };
    } else if (newElement.type === Fragment) {
      const newTree: RenderTree.FragmentNode = {
        ...(oldTree as RenderTree.FragmentNode),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(newElement.children.length),
        mutations: [],
      };
      this._diffChildren(
        (oldTree as RenderTree.FragmentNode).children.slice(),
        newTree.children,
        newElement.children,
        scope,
        newTree,
        newTree.mutations,
      );
      return newTree;
    } else {
      const dirty = (oldTree as RenderTree.NativeNode).hostNode.prepareUpdate(
        newElement.type,
        (oldTree as RenderTree.NativeNode).props,
        newElement.props,
      );
      if (!dirty) {
        return { ...oldTree, index, parent };
      }
      const newTree: RenderTree.NativeNode = {
        ...(oldTree as RenderTree.NativeNode),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(newElement.children.length),
      };
      for (let i = 0, l = newElement.children.length; i < l; i++) {
        newTree.children[i] = this._diffChild(
          oldTree.children[i]!,
          newElement.children[i]!,
          scope,
          i,
          newTree,
        );
      }
      return newTree;
    }
  }

  private _diffChildren(
    oldChildren: (RenderTree | undefined)[],
    newChildren: RenderTree[],
    newElements: VElement[],
    scope: Scope,
    parent: RenderTree,
    mutations: Mutation[],
  ): void {
    const oldKeys = oldChildren.map((node) => node!.key);
    const newKeys = newElements.map((element) => element.key);

    let oldHead = 0;
    let newHead = 0;
    let oldTail = oldKeys.length - 1;
    let newTail = newKeys.length - 1;
    let oldKeyToIndexMap: Map<unknown, number> | undefined;
    let newKeyToIndexMap: Map<unknown, number> | undefined;

    while (true) {
      if (newHead > newTail) {
        while (oldHead <= oldTail) {
          const node = oldChildren[oldHead];
          if (node !== undefined) {
            mutations.push({
              type: RemoveType,
              tree: node,
            });
          }
          oldHead++;
        }
        break;
      }
      if (oldHead > oldTail) {
        while (newHead <= newTail) {
          const node = this.render(
            newElements[newHead]!,
            scope,
            newHead,
            parent,
          );
          mutations.push({
            type: InsertType,
            tree: node,
            afterTree: newChildren[newTail + 1],
          });
          newChildren[newHead] = node;
          newHead++;
        }
        break;
      }
      if (oldChildren[oldHead] === undefined) {
        oldHead++;
      } else if (oldChildren[oldTail] === undefined) {
        oldTail--;
      } else if (Object.is(oldKeys[oldHead]!, newKeys[newHead]!)) {
        const newNode = this._diffChild(
          oldChildren[oldHead]!,
          newElements[newHead]!,
          scope,
          newHead,
          parent,
        );
        mutations.push({
          type: UpdateType,
          oldTree: oldChildren[oldHead]!,
          newTree: newNode,
        });
        newChildren[newHead] = newNode;
        oldHead++;
        newHead++;
      } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        const newNode = this._diffChild(
          oldChildren[oldTail]!,
          newElements[newTail]!,
          scope,
          newTail,
          parent,
        );
        mutations.push({
          type: UpdateType,
          oldTree: oldChildren[oldTail]!,
          newTree: newNode,
        });
        newChildren[newTail] = newNode;
        oldTail--;
        newTail--;
      } else if (
        Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
        Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
      ) {
        const headTree = this._diffChild(
          oldChildren[oldHead]!,
          newElements[newTail]!,
          scope,
          newTail,
          parent,
        );
        const tailTree = this._diffChild(
          oldChildren[oldTail]!,
          newElements[newHead]!,
          scope,
          newHead,
          parent,
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
            const newNode = this._diffChild(
              oldChildren[oldIndex]!,
              newElements[newTail]!,
              scope,
              newTail,
              parent,
            );
            mutations.push({
              type: UpdateAndMoveType,
              oldTree: oldChildren[oldIndex]!,
              newTree: newNode,
              afterTree: newChildren[newTail + 1],
            });
            newChildren[newTail] = newNode;
            oldChildren[oldIndex] = undefined;
          } else {
            const node = this.render(
              newElements[newTail]!,
              scope,
              newTail,
              parent,
            );
            mutations.push({
              type: InsertType,
              tree: node,
              afterTree: newChildren[newTail + 1],
            });
            newChildren[newTail] = node;
          }

          newTail--;
        }
      }
    }
  }

  private _settleSubtree(tree: RenderTree): void {
    if (typeof tree.type === 'function') {
      tree.scope.pendingLanes &= ~this._flushLanes;
    }

    for (const child of tree.children) {
      this._settleSubtree(child);
    }
  }

  private async _flush(): Promise<void> {
    while (true) {
      const updateBatch: Update[] = [];
      const effectBatch: (() => void)[] = [];
      let update: Update | undefined;

      this._flushLanes |= this._stagedLanes;

      while ((update = this._updateQueue.peek()) !== undefined) {
        if ((this._flushLanes & update.lanes) !== update.lanes) {
          break;
        }
        updateBatch.push(this._updateQueue.dequeue()!);
      }

      if (updateBatch.length === 0) {
        break;
      }

      try {
        for (const update of updateBatch) {
          const { lanes, unit } = update;

          if ((unit.scope.pendingLanes & lanes) === NoLanes) {
            continue;
          }

          effectBatch.push(unit.prepare(this));

          unit.scope.pendingLanes &= ~this._flushLanes;

          if (!(this._flushLanes & SyncLane)) {
            await this._adapter.yieldToMain();
          }
        }

        if (effectBatch.length > 0) {
          const commit = () => {
            for (const effect of effectBatch) {
              effect();
            }
          };
          if (this._flushLanes & SyncLane) {
            commit();
          } else if (this._flushLanes & ViewTransitionLane) {
            await this._adapter.startViewTransition(commit);
          } else {
            await this._adapter.requestCommit(commit);
          }
        }

        for (const { controller } of updateBatch) {
          controller.resolve();
        }
      } catch (error) {
        for (const { controller } of updateBatch) {
          controller.reject(error);
        }
      }
    }

    this._stagedLanes = NoLanes;
    this._flushLanes = NoLanes;
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

function compareUpdates(update1: Update, update2: Update): number {
  const lane1 = getHighestPriorityLane(update1.lanes);
  const lane2 = getHighestPriorityLane(update2.lanes);
  const level1 = update1.unit.scope.level;
  const level2 = update2.unit.scope.level;
  return lane1 !== lane2 ? lane1 - lane2 : level1 - level2;
}
