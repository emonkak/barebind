import {
  type Dispatcher,
  Fragment,
  type HostAdapter,
  type Lanes,
  MUTATION_TYPE_INSERT,
  MUTATION_TYPE_REMOVE,
  MUTATION_TYPE_UPDATE,
  MUTATION_TYPE_UPDATE_AND_MOVE,
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
  private _transitionCount: number = 0;
  private _updateCount: number = 0;

  constructor(renderer: HostAdapter) {
    this._adapter = renderer;
  }

  get flushLanes(): Lanes {
    return this._flushLanes;
  }

  diff(
    oldNode: RenderNode,
    newElement: VElement,
    scope: Scope,
    index: number,
    hostIndex: number,
    parent: RenderNode | null,
  ): RenderNode {
    if (oldNode.type !== newElement.type || oldNode.key !== newElement.key) {
      return this.render(newElement, scope, index, hostIndex, parent);
    } else if (oldNode.props === newElement.props) {
      return oldNode;
    } else if (typeof newElement.type === 'function') {
      if (
        ((oldNode as RenderNode.ComponentNode).state.handle.pendingLanes &
          this._flushLanes) ===
          NoLanes &&
        (oldNode as RenderNode.ComponentNode).type.arePropsEqual(
          oldNode.props,
          newElement.props,
        )
      ) {
        return oldNode;
      }
      const newNode: RenderNode.ComponentNode = {
        type: newElement.type,
        props: newElement.props,
        key: newElement.key,
        index,
        hostIndex,
        parent,
        children: oldNode.children.slice(),
        state: (oldNode as RenderNode.ComponentNode).state,
        dirty: true,
      };
      const subScope = scope.child(newElement.type);
      newNode.children[0] = this.diff(
        newNode.children[0]!,
        newNode.state.handle.render(newNode.props, subScope, this._flushLanes),
        subScope,
        0,
        hostIndex,
        newNode,
      );
      return newNode;
    } else if (newElement.type === Fragment) {
      const newNode: RenderNode.FragmentNode = {
        type: newElement.type,
        props: newElement.props,
        key: newElement.key,
        index,
        hostIndex,
        parent,
        children: new Array(newElement.children.length),
        state: { mutations: [] },
        dirty: true,
      };
      this._diffChildren(
        oldNode as RenderNode.FragmentNode,
        newNode,
        newElement.children,
        scope,
        hostIndex,
      );
      return newNode;
    } else {
      const newNode: RenderNode.NativeNode = {
        type: newElement.type,
        props: newElement.props,
        key: newElement.key,
        index,
        hostIndex,
        parent,
        children: new Array(newElement.children.length),
        state: (oldNode as RenderNode.NativeNode).state,
        dirty: true,
      };
      for (let i = 0, l = newElement.children.length; i < l; i++) {
        newNode.children[i] = this.diff(
          oldNode.children[i]!,
          newElement.children[i]!,
          scope,
          i,
          i,
          newNode,
        );
      }
      return newNode;
    }
  }

  nextIdentifier(): string {
    return this._adapter.getIdentifier() + '-' + this._identifierCount++;
  }

  nextTransition(): number {
    return this._transitionCount++;
  }

  render(
    element: VElement,
    scope: Scope,
    index: number = 0,
    hostIndex: number = 0,
    parent: RenderNode | null = null,
  ): RenderNode {
    if (typeof element.type === 'function') {
      const node: RenderNode.ComponentNode = {
        type: element.type,
        props: element.props,
        key: element.key,
        index,
        hostIndex,
        parent,
        children: new Array(1),
        state: { handle: element.type.newHandle(this), scope },
        dirty: true,
      };
      const subScope = scope.child(element.type);
      node.children[0] = this.render(
        node.state.handle.render(node.props, subScope, this._flushLanes),
        subScope,
        0,
        hostIndex,
        node,
      );
      return node;
    } else if (element.type === Fragment) {
      const node: RenderNode.FragmentNode = {
        type: element.type,
        props: element.props,
        key: element.key,
        index,
        hostIndex,
        parent,
        children: new Array(element.children.length),
        state: { mutations: [] },
        dirty: true,
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        node.children[i] = this.render(
          element.children[i]!,
          scope,
          i,
          hostIndex,
          node,
        );
      }
      return node;
    } else {
      const node: RenderNode.NativeNode = {
        type: element.type,
        props: element.props,
        key: element.key,
        index,
        hostIndex,
        parent,
        children: new Array(element.children.length),
        state: { hostNode: this._adapter.createHostNode(element, hostIndex) },
        dirty: true,
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        node.children[i] = this.render(element.children[i]!, scope, i, i, node);
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
    oldParent: RenderNode.FragmentNode,
    newParent: RenderNode.FragmentNode,
    newElements: VElement[],
    scope: Scope,
    hostIndex: number,
  ): void {
    const oldChildren: (RenderNode | undefined)[] = oldParent.children.slice();
    const newChildren = newParent.children;
    const oldKeys = oldChildren.map((node) => node!.key);
    const newKeys = newElements.map((element) => element.key);
    const mutations = newParent.state.mutations;

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
            hostIndex,
            newParent,
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
        const oldNode = oldChildren[oldHead]!;
        const newNode = this.diff(
          oldNode,
          newElements[newHead]!,
          scope,
          newHead,
          hostIndex,
          newParent,
        );
        if (oldNode !== newNode) {
          mutations.push({
            type: MUTATION_TYPE_UPDATE,
            oldNode: oldChildren[oldHead]!,
            newNode: newNode,
          });
        }
        newChildren[newHead] = newNode;
        oldHead++;
        newHead++;
      } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        const oldNode = oldChildren[oldTail]!;
        const newNode = this.diff(
          oldNode,
          newElements[newTail]!,
          scope,
          newTail,
          hostIndex,
          newParent,
        );
        if (oldNode !== newNode) {
          mutations.push({
            type: MUTATION_TYPE_UPDATE,
            oldNode: oldChildren[oldTail]!,
            newNode: newNode,
          });
        }
        newChildren[newTail] = newNode;
        oldTail--;
        newTail--;
      } else if (
        Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
        Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
      ) {
        const tailNode = this.diff(
          oldChildren[oldTail]!,
          newElements[newHead]!,
          scope,
          newHead,
          hostIndex,
          newParent,
        );
        const headNode = this.diff(
          oldChildren[oldHead]!,
          newElements[newTail]!,
          scope,
          newTail,
          hostIndex,
          newParent,
        );
        mutations.push({
          type: MUTATION_TYPE_UPDATE_AND_MOVE,
          oldNode: oldChildren[oldTail]!,
          newNode: tailNode,
          afterNode: oldChildren[oldHead],
        });
        mutations.push({
          type: MUTATION_TYPE_UPDATE_AND_MOVE,
          oldNode: oldChildren[oldHead]!,
          newNode: headNode,
          afterNode: newChildren[newTail + 1],
        });
        newChildren[newHead] = tailNode;
        newChildren[newTail] = headNode;
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
            const newNode = this.diff(
              oldChildren[oldIndex]!,
              newElements[newTail]!,
              scope,
              newTail,
              hostIndex,
              newParent,
            );
            mutations.push({
              type: MUTATION_TYPE_UPDATE_AND_MOVE,
              oldNode: oldChildren[oldIndex]!,
              newNode: newNode,
              afterNode: newChildren[newTail + 1],
            });
            newChildren[newTail] = newNode;
            oldChildren[oldIndex] = undefined;
          } else {
            const node = this.render(
              newElements[newTail]!,
              scope,
              newTail,
              hostIndex,
              newParent,
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
