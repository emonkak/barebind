import {
  type Dispatcher,
  Fragment,
  type HostAdapter,
  type Lanes,
  MUTATION_TYPE_INSERT,
  MUTATION_TYPE_REMOVE,
  MUTATION_TYPE_UPDATE,
  MUTATION_TYPE_UPDATE_AND_MOVE,
  type Mutation,
  type Reconciler,
  type RenderNode,
  type Scope,
  type Thunk,
  type UpdateHandle,
  type UpdateOptions,
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
  /** @internal */
  readonly _adapter: HostAdapter;
  /** @internal */
  readonly _updateQueue: PriorityQueue<Update> = new PriorityQueue(
    compareUpdates,
  );
  /** @internal */
  _updateBatch: Update[] = [];
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
    oldView: RenderNode,
    newElement: VElement,
    scope: Scope,
    index: number,
    parent: RenderNode | null,
  ): RenderNode {
    if (oldView.type !== newElement.type || oldView.key !== newElement.key) {
      return this.render(newElement, scope, index, parent);
    } else if (oldView.props === newElement.props) {
      return { ...oldView, index, parent };
    } else if (typeof newElement.type === 'function') {
      const newView: RenderNode.ComponentNode = {
        ...(oldView as RenderNode.ComponentNode),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
        children: oldView.children.slice(),
      };
      if (
        ((newView as RenderNode.ComponentNode).state.handle.pendingLanes &
          this._flushLanes) !==
          NoLanes ||
        !(newView as RenderNode.ComponentNode).type.arePropsEqual(
          oldView.props,
          newElement.props,
        )
      ) {
        const subScope = scope.child();
        newView.children[0] = this.diff(
          newView.children[0]!,
          newView.state.handle.render(newView, subScope, this._flushLanes),
          subScope,
          0,
          newView,
        );
      }
      return newView;
    } else if (newElement.type === Fragment) {
      const newView: RenderNode.FragmentNode = {
        ...(oldView as RenderNode.FragmentNode),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(newElement.children.length),
        state: { mutations: [] },
      };
      this._diffChildren(
        (oldView as RenderNode.FragmentNode).children.slice(),
        newView.children,
        newElement.children,
        scope,
        newView,
        newView.state.mutations,
      );
      return newView;
    } else {
      const newView: RenderNode.NativeNode = {
        ...(oldView as RenderNode.NativeNode),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(newElement.children.length),
      };
      for (let i = 0, l = newElement.children.length; i < l; i++) {
        newView.children[i] = this.diff(
          oldView.children[i]!,
          newElement.children[i]!,
          scope,
          i,
          newView,
        );
      }
      return newView;
    }
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
    parent: RenderNode | null = null,
  ): RenderNode {
    if (typeof element.type === 'function') {
      const node: RenderNode.ComponentNode = {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(1),
        state: { handle: element.type.newHandle(this) },
      };
      const subScope = scope.child();
      node.children[0] = this.render(
        node.state.handle.render(node, subScope, this._flushLanes),
        subScope,
        0,
        node,
      );
      return node;
    } else if (element.type === Fragment) {
      const node: RenderNode.FragmentNode = {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(element.children.length),
        state: { mutations: [] },
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        node.children[i] = this.render(element.children[i]!, scope, i, node);
      }
      return node;
    } else {
      const node: RenderNode.NativeNode = {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(element.children.length),
        state: { hostNode: this._adapter.createHostNode(element) },
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        node.children[i] = this.render(element.children[i]!, scope, i, node);
      }
      return node;
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

    if (((this._pendingLanes | this._stagedLanes) & lanes) !== lanes) {
      const priority = getPriorityFromLanes(lanes);
      this._pendingLanes |= lanes;
      this._adapter.requestCallback(
        () => {
          this._pendingLanes &= ~lanes;
          this._stagedLanes |= lanes;
          if (this._flushLanes === NoLanes) {
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

  private _diffChildren(
    oldChildren: (RenderNode | undefined)[],
    newChildren: RenderNode[],
    newElements: VElement[],
    scope: Scope,
    parent: RenderNode,
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
              type: MUTATION_TYPE_REMOVE,
              node,
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
            type: MUTATION_TYPE_INSERT,
            node,
            afterNode: newChildren[newTail + 1],
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
        const newView = this.diff(
          oldChildren[oldHead]!,
          newElements[newHead]!,
          scope,
          newHead,
          parent,
        );
        mutations.push({
          type: MUTATION_TYPE_UPDATE,
          oldNode: oldChildren[oldHead]!,
          newNode: newView,
        });
        newChildren[newHead] = newView;
        oldHead++;
        newHead++;
      } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        const newView = this.diff(
          oldChildren[oldTail]!,
          newElements[newTail]!,
          scope,
          newTail,
          parent,
        );
        mutations.push({
          type: MUTATION_TYPE_UPDATE,
          oldNode: oldChildren[oldTail]!,
          newNode: newView,
        });
        newChildren[newTail] = newView;
        oldTail--;
        newTail--;
      } else if (
        Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
        Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
      ) {
        const tailView = this.diff(
          oldChildren[oldTail]!,
          newElements[newHead]!,
          scope,
          newHead,
          parent,
        );
        const headView = this.diff(
          oldChildren[oldHead]!,
          newElements[newTail]!,
          scope,
          newTail,
          parent,
        );
        mutations.push({
          type: MUTATION_TYPE_UPDATE_AND_MOVE,
          oldNode: oldChildren[oldTail]!,
          newNode: tailView,
          afterNode: oldChildren[oldHead],
        });
        mutations.push({
          type: MUTATION_TYPE_UPDATE_AND_MOVE,
          oldNode: oldChildren[oldHead]!,
          newNode: headView,
          afterNode: newChildren[newTail + 1],
        });
        newChildren[newHead] = tailView;
        newChildren[newTail] = headView;
        oldHead++;
        newHead++;
        oldTail--;
        newTail--;
      } else {
        newKeyToIndexMap ??= buildKeyToIndexMap(newKeys, newHead, newTail);

        if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
          mutations.push({
            type: MUTATION_TYPE_REMOVE,
            node: oldChildren[oldHead]!,
          });
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          mutations.push({
            type: MUTATION_TYPE_REMOVE,
            node: oldChildren[oldTail]!,
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
            const newView = this.diff(
              oldChildren[oldIndex]!,
              newElements[newTail]!,
              scope,
              newTail,
              parent,
            );
            mutations.push({
              type: MUTATION_TYPE_UPDATE_AND_MOVE,
              oldNode: oldChildren[oldIndex]!,
              newNode: newView,
              afterNode: newChildren[newTail + 1],
            });
            newChildren[newTail] = newView;
            oldChildren[oldIndex] = undefined;
          } else {
            const node = this.render(
              newElements[newTail]!,
              scope,
              newTail,
              parent,
            );
            mutations.push({
              type: MUTATION_TYPE_INSERT,
              node,
              afterNode: newChildren[newTail + 1],
            });
            newChildren[newTail] = node;
          }

          newTail--;
        }
      }
    }
  }

  private async _flush(): Promise<void> {
    while (true) {
      let update: Update | undefined;

      this._flushLanes |= this._stagedLanes;
      this._stagedLanes = NoLanes;

      while ((update = this._updateQueue.peek()) !== undefined) {
        if ((this._flushLanes & update.lanes) !== update.lanes) {
          break;
        }
        this._updateBatch.push(this._updateQueue.dequeue()!);
      }

      if (this._updateBatch.length === 0) {
        break;
      }

      try {
        const thunkBatch: Thunk[] = [];
        const flushSync = (this._flushLanes & SyncLane) === SyncLane;

        for (const update of this._updateBatch) {
          const { lanes, unit } = update;

          if ((unit.pendingLanes & lanes) === NoLanes) {
            continue;
          }

          if (!flushSync && thunkBatch.length > 0) {
            await this._adapter.yieldToMain();
          }

          thunkBatch.push(unit.produce(this._flushLanes, this));
        }

        if (thunkBatch.length > 0) {
          const commit = () => {
            for (const thunk of thunkBatch) {
              thunk();
            }
          };
          if (flushSync) {
            commit();
          } else if (this._flushLanes & ViewTransitionLane) {
            await this._adapter.startViewTransition(commit);
          } else {
            await this._adapter.requestCommit(commit);
          }
        }

        for (const { controller } of this._updateBatch) {
          controller.resolve();
        }
      } catch (error) {
        for (const { controller } of this._updateBatch) {
          controller.reject(error);
        }
      } finally {
        this._updateBatch = [];
      }
    }

    this._flushLanes = NoLanes;
  }
}

export async function waitForStep(runtime: Runtime): Promise<boolean> {
  if (runtime._updateBatch.length > 0) {
    for (const update of runtime._updateBatch) {
      await update.controller.promise;
    }
    return true;
  } else {
    const update = runtime._updateQueue.peek();
    if (update !== undefined) {
      await update.controller.promise;
      return true;
    }
    return false;
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
  const level1 = update1.unit.level;
  const level2 = update2.unit.level;
  return lane1 !== lane2 ? lane1 - lane2 : level1 - level2;
}
