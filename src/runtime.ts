import { areDependenciesChange } from './compare.js';
import {
  createScope,
  Directive,
  Fragment,
  type HostAdapter,
  type HostTree,
  InsertType,
  type Lanes,
  type Mutation,
  type Reconciler,
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
  type UpdateUnit,
  type VElement,
} from './core.js';
import {
  getHighestPriorityLane,
  getPriorityFromLanes,
  getRenderLanes,
  NoLanes,
  ViewTransitionLane,
} from './lane.js';
import { PriorityQueue } from './queue.js';

interface Update {
  id: number;
  lanes: Lanes;
  unit: UpdateUnit;
  controller: PromiseWithResolvers<UpdateResult>;
}

export class Runtime implements Reconciler, UpdateScheduler {
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

  diff(oldTree: RenderRoot, element: VElement, scope: Scope): RenderRoot;
  diff(oldTree: RenderChild, newElement: VElement, scope: Scope): RenderChild;
  diff(oldTree: RenderTree, newElement: VElement, scope: Scope): RenderTree;
  diff(oldTree: RenderTree, newElement: VElement, scope: Scope): RenderTree {
    if (oldTree.type !== newElement.type || oldTree.key !== newElement.key) {
      return this.render(newElement, scope, oldTree.index, oldTree.parent);
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
        newTree.scope,
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
        scope,
        oldTree.parent!,
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

  nextIdentifier(): string {
    return this._adapter.getIdentifier() + '-' + this._identifierCount++;
  }

  nextTransition(): number {
    return this._transitionCount++;
  }

  render(element: VElement, scope: Scope): RenderRoot;
  render(
    element: VElement,
    scope: Scope,
    index: number,
    parent: RenderTree,
  ): RenderChild;
  render(
    element: VElement,
    scope: Scope,
    index: number,
    parent: RenderTree | null,
  ): RenderTree;
  render(
    element: VElement,
    scope: Scope,
    index: number = 0,
    parent: RenderTree | null = null,
  ): RenderTree {
    if (typeof element.type === 'function') {
      const tree: RenderChild.ComponentChild = {
        ...element,
        parent: parent!,
        children: new Array(1),
        index,
        instance: element.type.createInstance(element.props, this),
        scope: createScope(scope),
      };
      const returnElement = tree.instance.render(tree);
      tree.children[0] = this.render(returnElement, tree.scope, 0, tree);
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
        tree.children[i] = this.render(element.children[i]!, scope, i, tree);
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
        tree.children[i] = this.render(element.children[i]!, scope, i, tree);
      }
      return tree;
    }
  }

  schedule(unit: UpdateUnit, options: UpdateOptions = {}): UpdateHandle {
    const controller = Promise.withResolvers<UpdateResult>();
    const id = this._updateCount++;
    const lanes = getRenderLanes(options);

    this._updateQueue.enqueue({
      id,
      lanes,
      unit,
      controller,
    });

    if (((this._pendingLanes | this._flushLanes) & lanes) !== lanes) {
      const priority =
        options.priority ??
        getPriorityFromLanes(lanes) ??
        this._adapter.getTaskPriority();
      this._adapter.requestCallback(
        () => {
          const shouldFlush = this._flushLanes === NoLanes;
          this._pendingLanes &= ~lanes;
          this._flushLanes |= lanes;
          if (shouldFlush) {
            this._flush();
          }
        },
        { ...options, priority },
      );
      this._pendingLanes |= lanes;
    }

    unit.scope.pendingLanes |= lanes;

    return {
      id,
      lanes,
      finished: controller.promise,
    };
  }

  private _diffChildren(
    oldChildren: (RenderChild | undefined)[],
    newElements: VElement[],
    scope: Scope,
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
            scope,
            newHead,
            parent,
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
              scope,
              newTail,
              parent,
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

  private async _flush(): Promise<void> {
    let update: Update | undefined;

    while ((update = this._updateQueue.peek()) !== undefined) {
      const { controller, lanes, unit } = update;

      if ((this._flushLanes & lanes) !== lanes) {
        break;
      }

      try {
        if ((unit.scope.pendingLanes & lanes) === NoLanes) {
          controller.resolve({ status: 'skipped' });
          continue;
        }

        const commit = unit.prepare(this);

        unit.scope.pendingLanes &= ~this._flushLanes;

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
  const priority1 = getHighestPriorityLane(x.lanes);
  const priority2 = getHighestPriorityLane(y.lanes);
  return priority1 !== priority2
    ? priority1 - priority2
    : x.unit.scope.level - y.unit.scope.level;
}
