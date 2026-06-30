import {
  Bind,
  type Commit,
  type Dispatcher,
  Fragment,
  type HostAdapter,
  type Middleware,
  MUTATION_TYPE_INSERT,
  MUTATION_TYPE_REMOVE,
  MUTATION_TYPE_UPDATE,
  MUTATION_TYPE_UPDATE_AND_MOVE,
  type Mutation,
  type Part,
  type Renderer,
  type RenderNode,
  type RenderRoot,
  type Scope,
  type Transaction,
  type Update,
  type UpdateHandle,
  type UpdateOptions,
  type VElement,
  type VPortal,
  type VTemplate,
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

export class Runtime implements Renderer, Dispatcher {
  /** @internal */
  readonly _adapter: HostAdapter;
  /** @internal */
  readonly _updateQueue: PriorityQueue<Update> = new PriorityQueue(
    compareUpdates,
  );
  /** @internal */
  _updateBatch: Update[] = [];
  private _middlewares: Middleware[] = [];
  private _pendingLanes: number = NoLanes;
  private _stagedLanes: number = NoLanes;
  private _flushLanes: number = NoLanes;
  private _identifierCount: number = 0;
  private _transitionCount: number = 0;
  private _updateCount: number = 0;

  constructor(adapter: HostAdapter) {
    this._adapter = adapter;
  }

  diff(
    oldNode: RenderNode,
    newElement: VElement,
    scope: Scope,
    index: number,
    parent: RenderNode | RenderRoot,
  ): RenderNode {
    if (oldNode.type !== newElement.type || oldNode.key !== newElement.key) {
      return this.render(newElement, scope, index, parent, oldNode.part);
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
        children: oldNode.children,
        part: oldNode.part,
        state: (oldNode as RenderNode.BindNode).state,
        dirty: true,
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
        dirty: true,
      };
      newNode.state.mutations = this._diffChildren(
        oldNode as RenderNode.FragmentNode,
        newNode,
        newElement.children,
        scope,
      );
      return newNode;
    } else if (typeof newElement.type === 'function') {
      if (
        ((oldNode as RenderNode.ComponentNode).state.instance.pendingLanes &
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
        children: oldNode.children.slice(),
        part: oldNode.part,
        state: (oldNode as RenderNode.ComponentNode).state,
        dirty: true,
      };
      const subScope = scope.enter(newElement.type);
      newNode.children[0] = this.diff(
        newNode.children[0]!,
        newNode.state.instance.render(
          newNode.props,
          subScope,
          this._flushLanes,
        ),
        subScope,
        0,
        newNode,
      );
      newNode.state.scope = scope;
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
        dirty: false,
      };
      for (let i = 0, l = newElement.children.length; i < l; i++) {
        const newChild = this.diff(
          oldNode.children[i]!,
          newElement.children[i]!,
          scope,
          i,
          newNode,
        );
        newNode.children[i] = newChild;
        newNode.dirty ||= newChild.dirty;
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
    index: number,
    parent: RenderNode | RenderRoot,
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
        dirty: true,
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
        dirty: true,
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        node.children[i] = this.render(
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
        children: new Array(1),
        part,
        state: {
          instance: element.type.createInstance(this),
          scope,
        },
        dirty: true,
      };
      const subScope = scope.enter(element.type);
      node.children[0] = this.render(
        node.state.instance.render(node.props, subScope, this._flushLanes),
        subScope,
        0,
        node,
        part,
      );
      return node;
    } else {
      const block =
        'mode' in element.props
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
        dirty: true,
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        node.children[i] = this.render(
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
      types:
        typeof options.viewTransition === 'object'
          ? options.viewTransition
          : [],
      transaction,
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

  use(middleware: Middleware): void {
    this._middlewares.push(middleware);
  }

  private _diffChildren(
    oldParent: RenderNode,
    newParent: RenderNode,
    newElements: VElement[],
    scope: Scope,
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
              type: MUTATION_TYPE_REMOVE,
              node: oldChild,
            });
          }
          oldHead++;
        }
        break;
      }
      if (oldHead > oldTail) {
        while (newHead <= newTail) {
          const newChild = this.render(
            newElements[newHead]!,
            scope,
            newHead,
            newParent,
            newParent.part.splitPart(),
          );
          newMutations.push({
            type: MUTATION_TYPE_INSERT,
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
      } else if (Object.is(oldKeys[oldHead]!, newKeys[newHead]!)) {
        const oldChild = oldChildren[oldHead]!;
        const newChild = this.diff(
          oldChild,
          newElements[newHead]!,
          scope,
          newHead,
          newParent,
        );
        newMutations.push({
          type: MUTATION_TYPE_UPDATE,
          oldNode: oldChild,
          newNode: newChild,
          index: newHead,
        });
        newChildren[newHead] = newChild;
        oldHead++;
        newHead++;
      } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        const oldChild = oldChildren[oldTail]!;
        const newChild = this.diff(
          oldChild,
          newElements[newTail]!,
          scope,
          newTail,
          newParent,
        );
        newMutations.push({
          type: MUTATION_TYPE_UPDATE,
          oldNode: oldChild,
          newNode: newChild,
          index: newTail,
        });
        newChildren[newTail] = newChild;
        oldTail--;
        newTail--;
      } else if (
        Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
        Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
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
          type: MUTATION_TYPE_UPDATE_AND_MOVE,
          oldNode: oldChildren[oldTail]!,
          newNode: tailChild,
          afterNode: oldChildren[oldHead],
          index: newHead,
        });
        newMutations.push({
          type: MUTATION_TYPE_UPDATE_AND_MOVE,
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
            type: MUTATION_TYPE_REMOVE,
            node: oldChild,
          });
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          const oldChild = oldChildren[oldTail]!;
          newMutations.push({
            type: MUTATION_TYPE_REMOVE,
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
              type: MUTATION_TYPE_UPDATE_AND_MOVE,
              oldNode: oldChildren[oldIndex]!,
              newNode: newChild,
              afterNode: newChildren[newTail + 1],
              index: newTail,
            });
            newChildren[newTail] = newChild;
            oldChildren[oldIndex] = undefined;
          } else {
            const newChild = this.render(
              newElements[newTail]!,
              scope,
              newTail,
              newParent,
              newParent.part.splitPart(),
            );
            newMutations.push({
              type: MUTATION_TYPE_INSERT,
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
      let update: Update | undefined;

      this._flushLanes |= this._stagedLanes;
      this._stagedLanes = NoLanes;

      while ((update = this._updateQueue.peek()) !== undefined) {
        if (
          (update.lanes & this._flushLanes) !== update.lanes &&
          getHighestPriorityLane(this._flushLanes) <
            getHighestPriorityLane(update.lanes)
        ) {
          break;
        }
        this._flushLanes |= update.lanes;
        this._updateBatch.push(this._updateQueue.dequeue()!);
      }

      if (this._updateBatch.length === 0) {
        break;
      }

      try {
        const commitBatch: Commit[] = [];

        for (const update of this._updateBatch) {
          const { lanes, transaction } = update;
          if ((transaction.pendingLanes & lanes) === NoLanes) {
            continue;
          }
          commitBatch.push(runPipeline(update, this, this._middlewares));
        }

        if (commitBatch.length > 0) {
          const callback = () => {
            for (const commit of commitBatch) {
              commit();
            }
          };
          if ((this._flushLanes & SyncLane) === SyncLane) {
            callback();
          } else if (this._flushLanes & ViewTransitionLane) {
            await this._adapter.startViewTransition(
              callback,
              this._updateBatch.flatMap((update) => update.types),
            );
          } else {
            await this._adapter.requestCommit(callback);
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

export async function step(runtime: Runtime): Promise<boolean> {
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
  const highestLane1 = getHighestPriorityLane(update1.lanes);
  const highestLane2 = getHighestPriorityLane(update2.lanes);
  if (highestLane1 !== highestLane2) {
    return highestLane1 - highestLane2;
  }
  const level1 = update1.transaction.scope.level;
  const level2 = update2.transaction.scope.level;
  return level1 - level2;
}

function runPipeline(
  update: Update,
  renderer: Renderer,
  middlewares: Middleware[],
) {
  function resumePipeline(update: Update, index: number): Commit {
    return (
      middlewares[index]?.handle(update, (update) =>
        resumePipeline(update, index + 1),
      ) ?? update.transaction.prepare(update.lanes, renderer)
    );
  }
  return resumePipeline(update, 0);
}
