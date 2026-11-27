import {
  Bind,
  type Commit,
  type CommitHandler,
  type Dispatcher,
  Fragment,
  type HostAdapter,
  type Middleware,
  type Mutation,
  MutationType,
  NodeFlag,
  type Part,
  type RenderNode,
  type Scope,
  type UnitOfWork,
  type Update,
  type UpdateHandle,
  type UpdateOptions,
  type VElement,
  type VPortal,
  type VTemplate,
} from './abstractions.js';
import {
  getHighestPriorityLane,
  getPriorityFromLanes,
  getRenderLanes,
  Lane,
} from './lane.js';
import { PriorityQueue } from './queue.js';

export class Runtime implements Dispatcher {
  /** @internal */
  readonly _adapter: HostAdapter;
  /** @internal */
  readonly _middlewares: Middleware[] = [];
  /** @internal */
  readonly _updateQueue: PriorityQueue<Update> = new PriorityQueue(
    compareUpdates,
  );
  /** @internal */
  _updateBatch: Update[] = [];
  /** @internal */
  _pendingLanes: number = Lane.NoLanes;
  /** @internal */
  _stagedLanes: number = Lane.NoLanes;
  /** @internal */
  _renderLanes: number = Lane.NoLanes;
  /** @internal */
  _identifierCount: number = 0;
  /** @internal */
  _transitionCount: number = 0;
  /** @internal */
  _txCount: number = 0;
  /** @internal */
  _updateCount: number = 0;

  constructor(adapter: HostAdapter) {
    this._adapter = adapter;
  }

  get renderLanes(): number {
    return this._renderLanes;
  }

  get txId(): number {
    return this._txCount;
  }

  build(
    element: VElement,
    index: number,
    parent: RenderNode | null,
    scope: Scope,
    part: Part,
  ): RenderNode {
    if (element.type === Bind) {
      return {
        type: element.type,
        props: element.props,
        key: element.key,
        index,
        parent,
        children: [],
        part,
        state: null,
        flags: NodeFlag.NoFlags,
      };
    } else if (element.type === Fragment) {
      const node: RenderNode.FragmentNode = {
        type: element.type,
        props: element.props,
        key: element.key,
        index,
        parent,
        children: new Array(element.children.length),
        part,
        state: { mutations: [] },
        flags: NodeFlag.NoFlags,
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        node.children[i] = this.build(
          element.children[i]!,
          i,
          node,
          scope,
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
        children: new Array(1),
        part,
        state: {
          renderer: element.type.createRenderer(this),
          txId: this._txCount,
          version: 0,
          pendingLanes: Lane.NoLanes,
        },
        flags: NodeFlag.NoFlags,
      };
      const result = node.state.renderer.render(node, scope, this._renderLanes);
      node.children[0] = this.build(
        result.element,
        0,
        node,
        result.scope,
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
        children: new Array(element.children.length),
        part,
        state: { block },
        flags: NodeFlag.NoFlags,
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        node.children[i] = this.build(
          element.children[i]!,
          i,
          node,
          scope,
          block.parts[i]!,
        );
      }
      return node;
    }
  }

  diff(
    oldNode: RenderNode,
    newElement: VElement,
    index: number,
    parent: RenderNode | null,
    scope: Scope,
    dirty: boolean,
  ): RenderNode {
    if (oldNode.type !== newElement.type || oldNode.key !== newElement.key) {
      return this.build(newElement, index, parent, scope, oldNode.part);
    }

    if (
      !dirty &&
      (typeof newElement.type === 'function'
        ? ((oldNode as RenderNode.ComponentNode).state.pendingLanes &
            this._renderLanes) ===
            Lane.NoLanes &&
          !(oldNode as RenderNode.ComponentNode).state.renderer.shouldRender(
            oldNode.props,
            newElement.props,
          )
        : oldNode.props === newElement.props)
    ) {
      return oldNode;
    }

    if (newElement.type === Bind) {
      return {
        type: newElement.type,
        props: newElement.props,
        key: newElement.key,
        index,
        parent,
        children: [],
        part: oldNode.part,
        state: (oldNode as RenderNode.BindNode).state,
        flags: NodeFlag.NoFlags,
      };
    } else if (newElement.type === Fragment) {
      const newNode: RenderNode.FragmentNode = {
        type: newElement.type,
        props: newElement.props,
        key: newElement.key,
        index,
        parent,
        children: new Array(newElement.children.length),
        part: oldNode.part,
        state: (oldNode as RenderNode.FragmentNode).state,
        flags: NodeFlag.NoFlags,
      };
      newNode.state.mutations = diffChildren(
        this,
        oldNode,
        newNode,
        newElement.children,
        scope,
        dirty,
      );
      return newNode;
    } else if (typeof newElement.type === 'function') {
      const newNode: RenderNode.ComponentNode = {
        type: newElement.type,
        props: newElement.props,
        key: newElement.key,
        index,
        parent,
        children: new Array(1),
        part: oldNode.part,
        state: (oldNode as RenderNode.ComponentNode).state,
        flags: NodeFlag.NoFlags,
      };
      newNode.state.txId = this._txCount;
      const result = newNode.state.renderer.render(
        newNode,
        scope,
        this._renderLanes,
      );
      newNode.state.version++;
      newNode.state.pendingLanes &= ~result.consumedLanes;
      newNode.children[0] = this.diff(
        oldNode.children[0]!,
        result.element,
        0,
        newNode,
        result.scope,
        dirty || result.dirty,
      );
      return newNode;
    } else {
      const newNode: RenderNode.BlockNode = {
        type: newElement.type,
        props: newElement.props,
        key: newElement.key,
        index,
        parent,
        children: new Array(newElement.children.length),
        part: oldNode.part,
        state: (oldNode as RenderNode.BlockNode).state,
        flags: NodeFlag.NoFlags,
      };
      for (let i = 0, l = newElement.children.length; i < l; i++) {
        newNode.children[i] = this.diff(
          oldNode.children[i]!,
          newElement.children[i]!,
          i,
          newNode,
          scope,
          dirty,
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

  schedule(unitOfWork: UnitOfWork, options: UpdateOptions = {}): UpdateHandle {
    const id = ++this._updateCount;
    const lanes =
      getRenderLanes(options) ||
      this._renderLanes ||
      this._adapter.getRenderLanes();
    const controller = Promise.withResolvers<void>();
    const update: Update = {
      id,
      lanes,
      handler: options.handler ?? null,
      controller,
      unitOfWork,
    };

    if ((this._renderLanes & lanes) === lanes) {
      this._updateBatch.push(update);
    } else {
      this._updateQueue.enqueue(update);

      if (((this._pendingLanes | this._stagedLanes) & lanes) !== lanes) {
        const callback = () => {
          const shouldFlush = this._stagedLanes === Lane.NoLanes;
          this._pendingLanes &= ~lanes;
          this._stagedLanes |= lanes;
          if (shouldFlush) {
            flush(this);
          }
        };
        this._pendingLanes |= lanes;
        if (lanes & Lane.SyncLane) {
          queueMicrotask(callback);
        } else {
          const priority = options.priority ?? getPriorityFromLanes(lanes);
          this._adapter.requestCallback(callback, { ...options, priority });
        }
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
  const level1 = update1.unitOfWork.scope.level;
  const level2 = update2.unitOfWork.scope.level;
  return level1 - level2;
}

function diffChildren(
  runtime: Runtime,
  oldParent: RenderNode,
  newParent: RenderNode,
  newElements: VElement[],
  scope: Scope,
  dirty: boolean,
): Mutation[] {
  const oldChildren: (RenderNode | undefined)[] = oldParent.children.slice();
  const newChildren = newParent.children;
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
            type: MutationType.Remove,
            node: oldChild,
          });
        }
        oldHead++;
      }
      break;
    }
    if (oldHead > oldTail) {
      while (newHead <= newTail) {
        const newChild = runtime.build(
          newElements[newHead]!,
          newHead,
          newParent,
          scope,
          newParent.part.splitPart(),
        );
        newMutations.push({
          type: MutationType.Insert,
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
    } else if (oldKeys[oldHead] === newKeys[newHead]) {
      const oldChild = oldChildren[oldHead]!;
      const newChild = runtime.diff(
        oldChild,
        newElements[newHead]!,
        newHead,
        newParent,
        scope,
        dirty,
      );
      newMutations.push({
        type: MutationType.Update,
        oldNode: oldChild,
        newNode: newChild,
        index: newHead,
      });
      newChildren[newHead] = newChild;
      oldHead++;
      newHead++;
    } else if (oldKeys[oldTail] === newKeys[newTail]) {
      const oldChild = oldChildren[oldTail]!;
      const newChild = runtime.diff(
        oldChild,
        newElements[newTail]!,
        newTail,
        newParent,
        scope,
        dirty,
      );
      newMutations.push({
        type: MutationType.Update,
        oldNode: oldChild,
        newNode: newChild,
        index: newTail,
      });
      newChildren[newTail] = newChild;
      oldTail--;
      newTail--;
    } else if (
      oldKeys[oldHead] === newKeys[newTail] &&
      oldKeys[oldTail] === newKeys[newHead]
    ) {
      const tailChild = runtime.diff(
        oldChildren[oldTail]!,
        newElements[newHead]!,
        newHead,
        newParent,
        scope,
        dirty,
      );
      const headChild = runtime.diff(
        oldChildren[oldHead]!,
        newElements[newTail]!,
        newTail,
        newParent,
        scope,
        dirty,
      );
      newMutations.push({
        type: MutationType.UpdateAndMove,
        oldNode: oldChildren[oldTail]!,
        newNode: tailChild,
        afterNode: oldChildren[oldHead],
        index: newHead,
      });
      newMutations.push({
        type: MutationType.UpdateAndMove,
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
          type: MutationType.Remove,
          node: oldChild,
        });
        oldHead++;
      } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
        const oldChild = oldChildren[oldTail]!;
        newMutations.push({
          type: MutationType.Remove,
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
          const newChild = runtime.diff(
            oldChildren[oldIndex]!,
            newElements[newTail]!,
            newTail,
            newParent,
            scope,
            dirty,
          );
          newMutations.push({
            type: MutationType.UpdateAndMove,
            oldNode: oldChildren[oldIndex]!,
            newNode: newChild,
            afterNode: newChildren[newTail + 1],
            index: newTail,
          });
          newChildren[newTail] = newChild;
          oldChildren[oldIndex] = undefined;
        } else {
          const newChild = runtime.build(
            newElements[newTail]!,
            newTail,
            newParent,
            scope,
            newParent.part.splitPart(),
          );
          newMutations.push({
            type: MutationType.Insert,
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

async function flush(runtime: Runtime): Promise<void> {
  while (true) {
    // Batch updates that are already staged and of equal or higher priority.
    while (true) {
      const update = runtime._updateQueue.peek();
      if (
        update === undefined ||
        (update.lanes & runtime._stagedLanes) !== update.lanes ||
        (runtime._renderLanes !== Lane.NoLanes &&
          getHighestPriorityLane(runtime._renderLanes) <
            getHighestPriorityLane(update.lanes))
      ) {
        // The update is not yet staged, or is lower-priority than the current
        // batch; defer it so it commits as its own batch.
        break;
      }
      runtime._renderLanes |= update.lanes;
      runtime._updateBatch.push(runtime._updateQueue.dequeue()!);
    }

    if (runtime._renderLanes === Lane.NoLanes) {
      break;
    }

    try {
      const commitBatch: { commit: Commit; handler: CommitHandler | null }[] =
        [];
      const renderLanes = runtime._renderLanes;
      runtime._txCount++;

      try {
        for (const update of runtime._updateBatch) {
          const { handler, lanes, unitOfWork } = update;
          if (unitOfWork.pendingLanes & lanes) {
            const commit = runPipeline(update, runtime, runtime._middlewares);
            commitBatch.push({ commit, handler });
          }
        }
      } finally {
        runtime._renderLanes = Lane.NoLanes;
      }

      if (commitBatch.length > 0) {
        const callback = async () => {
          for (const { commit, handler } of commitBatch) {
            if (handler !== null) {
              await handler(commit);
            } else {
              commit();
            }
          }
        };
        if (renderLanes & (Lane.SyncLane | Lane.UserHandlerLane)) {
          await callback();
        } else {
          await runtime._adapter.requestCommit(callback);
        }
      }

      for (const { controller } of runtime._updateBatch) {
        controller.resolve();
      }
    } catch (error) {
      for (const { controller } of runtime._updateBatch) {
        controller.reject(error);
      }
    } finally {
      runtime._updateBatch = [];
    }
  }

  runtime._stagedLanes = Lane.NoLanes;
}

function runPipeline(
  update: Update,
  dispatcher: Dispatcher,
  middlewares: Middleware[],
) {
  function next(update: Update, dispatcher: Dispatcher, index: number): Commit {
    return index < middlewares.length
      ? middlewares[index]!.handle(update, dispatcher, (update, dispatcher) =>
          next(update, dispatcher, index + 1),
        )
      : update.unitOfWork.prepare(dispatcher);
  }
  return next(update, dispatcher, 0);
}
