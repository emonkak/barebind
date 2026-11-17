import {
  Bind,
  type Commit,
  type CommitHandler,
  type Dispatcher,
  Fragment,
  type HostAdapter,
  type Lanes,
  type Middleware,
  type Mutation,
  MutationType,
  type Part,
  type Reconciler,
  type RenderNode,
  type Scope,
  type Transaction,
  type Update,
  type UpdateHandle,
  type UpdateOptions,
  type VElement,
  type VPortal,
  type VTemplate,
} from './base.js';
import { is } from './compare.js';
import {
  getHighestPriorityLane,
  getLaneFromPriority,
  getPriorityFromLanes,
  getRenderLanes,
  NoLanes,
  SyncLane,
  UserHandlerLane,
} from './lane.js';
import { PriorityQueue } from './queue.js';
import { enterScope } from './scope.js';

export class Runtime implements Dispatcher, Reconciler {
  /** @internal */
  readonly _updateQueue: PriorityQueue<Update> = new PriorityQueue(
    compareUpdates,
  );
  /** @internal */
  _updateBatch: Update[] = [];
  private readonly _adapter: HostAdapter;
  private readonly _middlewares: Middleware[] = [];
  private _pendingLanes: number = NoLanes;
  private _stagedLanes: number = NoLanes;
  private _flushLanes: number = NoLanes;
  private _identifierCount: number = 0;
  private _transitionCount: number = 0;
  private _updateCount: number = 0;

  constructor(adapter: HostAdapter) {
    this._adapter = adapter;
  }

  build(
    element: VElement,
    scope: Scope,
    index: number,
    parent: RenderNode | null,
    part: Part,
  ): RenderNode {
    if (element.type === Bind) {
      return {
        type: element.type,
        props: element.props,
        key: element.key,
        index,
        parent,
        left: [],
        right: [],
        part,
        state: null,
      };
    } else if (element.type === Fragment) {
      const node: RenderNode.FragmentNode = {
        type: element.type,
        props: element.props,
        key: element.key,
        index,
        parent,
        left: new Array(element.children.length),
        right: [],
        part,
        state: { mutations: [] },
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        node.left[i] = this.build(
          element.children[i]!,
          scope,
          i,
          node,
          part.splitPart(),
        );
      }
      return node;
    } else if (typeof element.type === 'function') {
      const node: RenderNode.ComponentNode = {
        type: element.type,
        props: element.props,
        key: element.key,
        index,
        parent,
        left: new Array(1),
        right: [],
        part,
        state: {
          controller: element.type.createController(this),
          scope,
          pendingLanes: NoLanes,
        },
      };
      const subScope = enterScope(scope, element.type);
      node.left[0] = this.build(
        node.state.controller.render(node, subScope, this._flushLanes),
        subScope,
        0,
        node,
        part,
      );
      return node;
    } else {
      const block = Array.isArray(element.type)
        ? this._adapter.renderTemplate(element as VTemplate)
        : this._adapter.renderPortal(element as VPortal);
      const node: RenderNode.BlockNode = {
        type: element.type,
        props: element.props,
        key: element.key,
        index,
        parent,
        left: new Array(element.children.length),
        right: [],
        part,
        state: { block },
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        node.left[i] = this.build(
          element.children[i]!,
          scope,
          i,
          node,
          block.parts[i]!,
        );
      }
      return node;
    }
  }

  diff(
    oldNode: RenderNode,
    newElement: VElement,
    scope: Scope,
    index: number,
    parent: RenderNode | null,
  ): RenderNode {
    if (oldNode.type !== newElement.type || !is(oldNode.key, newElement.key)) {
      return this.build(newElement, scope, index, parent, oldNode.part);
    }
    if (oldNode.props === newElement.props) {
      return oldNode;
    }
    if (newElement.type === Bind) {
      return {
        type: newElement.type,
        props: newElement.props,
        key: newElement.key,
        index,
        parent,
        left: oldNode.left,
        right: oldNode.right,
        part: oldNode.part,
        state: (oldNode as RenderNode.BindNode).state,
      };
    } else if (newElement.type === Fragment) {
      const newNode: RenderNode.FragmentNode = {
        type: newElement.type,
        props: newElement.props,
        key: newElement.key,
        index,
        parent,
        left: new Array(newElement.children.length),
        right: oldNode.right,
        part: oldNode.part,
        state: (oldNode as RenderNode.FragmentNode).state,
      };
      newNode.state.mutations = this._diffChildren(
        newNode,
        newElement.children,
        scope,
      );
      return newNode;
    } else if (typeof newElement.type === 'function') {
      if (
        ((oldNode as RenderNode.ComponentNode).state.pendingLanes &
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
        parent,
        left: oldNode.right.slice(),
        right: oldNode.right,
        part: oldNode.part,
        state: (oldNode as RenderNode.ComponentNode).state,
      };
      const subScope = enterScope(scope, newElement.type);
      newNode.left[0] = this.diff(
        newNode.right[0]!,
        newNode.state.controller.render(newNode, subScope, this._flushLanes),
        subScope,
        0,
        newNode,
      );
      newNode.state.scope = scope;
      newNode.state.pendingLanes &= ~this._flushLanes;
      return newNode;
    } else {
      const newNode: RenderNode.BlockNode = {
        type: newElement.type,
        props: newElement.props,
        key: newElement.key,
        index,
        parent,
        left: new Array(newElement.children.length),
        right: oldNode.right,
        part: oldNode.part,
        state: (oldNode as RenderNode.BlockNode).state,
      };
      for (let i = 0, l = newElement.children.length; i < l; i++) {
        newNode.left[i] = this.diff(
          newNode.right[i]!,
          newElement.children[i]!,
          scope,
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

  schedule(
    transaction: Transaction,
    options: UpdateOptions = {},
  ): UpdateHandle {
    const id = this._updateCount++;
    const lanes =
      getRenderLanes(options) ||
      getLaneFromPriority(this._adapter.getTaskPriority());
    const controller = Promise.withResolvers<void>();

    this._updateQueue.enqueue({
      id,
      lanes,
      handler: options.handler ?? null,
      controller,
      transaction,
    });

    if (((this._pendingLanes | this._stagedLanes) & lanes) !== lanes) {
      const callback = () => {
        this._pendingLanes &= ~lanes;
        this._stagedLanes |= lanes;
        if (this._flushLanes === NoLanes) {
          this._flush();
        }
      };
      this._pendingLanes |= lanes;
      if (lanes & SyncLane) {
        queueMicrotask(callback);
      } else {
        const priority = options.priority ?? getPriorityFromLanes(lanes);
        this._adapter.requestCallback(callback, { ...options, priority });
      }
    }

    return {
      id,
      lanes,
      finished: controller.promise,
    };
  }

  use(middleware: Middleware): () => void {
    this._middlewares.push(middleware);
    return () => {
      const index = this._middlewares.indexOf(middleware);
      if (index >= 0) {
        // Must not be called from within Middleware.handle() before the
        // remaining middleware have run; pipeline indices shift, which is
        // undefined behavior.
        this._middlewares.splice(index, 1);
      }
    };
  }

  private _diffChildren(
    newParent: RenderNode,
    newElements: VElement[],
    scope: Scope,
  ): Mutation[] {
    const oldChildren: (RenderNode | undefined)[] = newParent.right.slice();
    const newChildren = newParent.left;
    const oldKeys = oldChildren.map((child) => child!.key);
    const newKeys = newElements.map((element) => element.key);
    const newMutations: Mutation[] = [];

    let oldHead = 0;
    let newHead = 0;
    let oldTail = oldKeys.length - 1;
    let newTail = newKeys.length - 1;
    let oldKeyToIndexMap: Map<unknown, number> | undefined;
    let newKeyToIndexMap: Map<unknown, number> | undefined;

    while (true) {
      if (newHead > newTail) {
        while (oldHead <= oldTail) {
          const oldChild = oldChildren[oldHead];
          if (oldChild !== undefined) {
            newMutations.push({
              type: MutationType.REMOVE,
              node: oldChild,
            });
          }
          oldHead++;
        }
        break;
      }
      if (oldHead > oldTail) {
        while (newHead <= newTail) {
          const newChild = this.build(
            newElements[newHead]!,
            scope,
            newHead,
            newParent,
            newParent.part.splitPart(),
          );
          newMutations.push({
            type: MutationType.INSERT,
            node: newChild,
            afterNode: newChildren[newTail + 1],
          });
          newChildren[newHead] = newChild;
          newHead++;
        }
        break;
      }
      if (oldChildren[oldHead] === undefined) {
        oldHead++;
      } else if (oldChildren[oldTail] === undefined) {
        oldTail--;
      } else if (is(oldKeys[oldHead]!, newKeys[newHead]!)) {
        const oldChild = oldChildren[oldHead]!;
        const newChild = this.diff(
          oldChild,
          newElements[newHead]!,
          scope,
          newHead,
          newParent,
        );
        newMutations.push({
          type: MutationType.UPDATE,
          oldNode: oldChild,
          newNode: newChild,
          index: newHead,
        });
        newChildren[newHead] = newChild;
        oldHead++;
        newHead++;
      } else if (is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        const oldChild = oldChildren[oldTail]!;
        const newChild = this.diff(
          oldChild,
          newElements[newTail]!,
          scope,
          newTail,
          newParent,
        );
        newMutations.push({
          type: MutationType.UPDATE,
          oldNode: oldChild,
          newNode: newChild,
          index: newTail,
        });
        newChildren[newTail] = newChild;
        oldTail--;
        newTail--;
      } else if (
        is(oldKeys[oldHead]!, newKeys[newTail]!) &&
        is(oldKeys[oldTail]!, newKeys[newHead]!)
      ) {
        const tailChild = this.diff(
          oldChildren[oldTail]!,
          newElements[newHead]!,
          scope,
          newHead,
          newParent,
        );
        const headChild = this.diff(
          oldChildren[oldHead]!,
          newElements[newTail]!,
          scope,
          newTail,
          newParent,
        );
        newMutations.push({
          type: MutationType.UPDATE_AND_MOVE,
          oldNode: oldChildren[oldTail]!,
          newNode: tailChild,
          afterNode: oldChildren[oldHead],
          index: newHead,
        });
        newMutations.push({
          type: MutationType.UPDATE_AND_MOVE,
          oldNode: oldChildren[oldHead]!,
          newNode: headChild,
          afterNode: newChildren[newTail + 1],
          index: newTail,
        });
        newChildren[newHead] = tailChild;
        newChildren[newTail] = headChild;
        oldHead++;
        newHead++;
        oldTail--;
        newTail--;
      } else {
        newKeyToIndexMap ??= buildKeyToIndexMap(newKeys, newHead, newTail);

        if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
          const oldChild = oldChildren[oldHead]!;
          newMutations.push({
            type: MutationType.REMOVE,
            node: oldChild,
          });
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          const oldChild = oldChildren[oldTail]!;
          newMutations.push({
            type: MutationType.REMOVE,
            node: oldChild,
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
            const newChild = this.diff(
              oldChildren[oldIndex]!,
              newElements[newTail]!,
              scope,
              newTail,
              newParent,
            );
            newMutations.push({
              type: MutationType.UPDATE_AND_MOVE,
              oldNode: oldChildren[oldIndex]!,
              newNode: newChild,
              afterNode: newChildren[newTail + 1],
              index: newTail,
            });
            newChildren[newTail] = newChild;
            oldChildren[oldIndex] = undefined;
          } else {
            const newChild = this.build(
              newElements[newTail]!,
              scope,
              newTail,
              newParent,
              newParent.part.splitPart(),
            );
            newMutations.push({
              type: MutationType.INSERT,
              node: newChild,
              afterNode: newChildren[newTail + 1],
            });
            newChildren[newTail] = newChild;
          }

          newTail--;
        }
      }
    }

    return newMutations;
  }

  private async _flush(): Promise<void> {
    while (true) {
      // Only updates of equal or higher priority are batched. The queue is
      // lane-ordered, so a lower-priority update breaks the batch.
      while (true) {
        const update = this._updateQueue.peek();
        if (
          update === undefined ||
          ((update.lanes & this._stagedLanes) !== update.lanes &&
            getHighestPriorityLane(this._flushLanes) <
              getHighestPriorityLane(update.lanes))
        ) {
          // The update is not staged yet and lower-priority than the batch;
          // defer it so it commits as its own batch.
          break;
        }
        this._flushLanes |= update.lanes;
        this._updateBatch.push(this._updateQueue.dequeue()!);
      }

      if (this._flushLanes === NoLanes) {
        break;
      }

      try {
        const commitBatch: { commit: Commit; handler: CommitHandler | null }[] =
          [];

        for (const update of this._updateBatch) {
          const { handler, lanes, transaction } = update;
          if (transaction.pendingLanes & lanes) {
            const commit = runPipeline(
              update,
              this,
              this._middlewares,
              this._flushLanes,
            );
            commitBatch.push({ commit, handler });
          }
        }

        if (commitBatch.length > 0) {
          if (this._flushLanes & UserHandlerLane) {
            for (const { commit, handler } of commitBatch) {
              if (handler !== null) {
                await handler(commit);
              } else {
                commit();
              }
            }
          } else {
            const callback = () => {
              for (const { commit } of commitBatch) {
                commit();
              }
            };
            if (this._flushLanes & SyncLane) {
              callback();
            } else {
              await this._adapter.requestCommit(callback);
            }
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
        this._flushLanes = NoLanes;
      }
    }

    this._stagedLanes = NoLanes;
  }
}

export async function step(runtime: Runtime): Promise<boolean> {
  const update = runtime._updateBatch[0] ?? runtime._updateQueue.peek();
  if (update === undefined) {
    return false;
  }
  await update.controller.promise;
  return true;
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
  if (lane1 !== lane2) {
    return lane1 - lane2;
  }
  const level1 = update1.transaction.scope.level;
  const level2 = update2.transaction.scope.level;
  return level1 - level2;
}

function runPipeline(
  update: Update,
  reconciler: Reconciler,
  middlewares: Middleware[],
  renderLanes: Lanes,
) {
  function continuePipeline(update: Update, index: number): Commit {
    return index < middlewares.length
      ? middlewares[index]!.handle(update, (update) =>
          continuePipeline(update, index + 1),
        )
      : update.transaction.prepare(reconciler, renderLanes);
  }
  return continuePipeline(update, 0);
}
